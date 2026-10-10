const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parses and clamps page/limit query params. Never trusts the client for
 * an unbounded limit — this is what keeps a single /admin/users or
 * /admin/bookings request from being turned into a full-collection dump.
 */
export function parsePagination(query = {}) {
    let page = Number.parseInt(query.page, 10);
    let limit = Number.parseInt(query.limit, 10);

    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

export function buildMeta({ page, limit, total }) {
    return {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
    };
}

/**
 * Whitelist-based date range parser for createdAt-style filters.
 * Returns undefined (not an empty object) when neither bound is given,
 * so it's safe to spread straight into a Mongo filter.
 */
export function parseDateRange(query = {}, field = "createdAt") {
    const { from, to } = query;
    const range = {};

    if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) range.$gte = d;
    }
    if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) range.$lte = d;
    }

    return Object.keys(range).length ? { [field]: range } : undefined;
}

