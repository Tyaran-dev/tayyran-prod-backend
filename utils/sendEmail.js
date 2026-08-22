import nodemailer from 'nodemailer';


// ============================================
// HELPERS
// ============================================

const stripHtml = (html) => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
};

const formatCancellationDate = (date) => {
  if (!date) return "-";
  const parsed = new Date(
    date.replace(
      /(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})/,
      "$3-$2-$1T$4:$5:$6"
    )
  );
  if (isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatStayDate = (dateStr) => {
  if (!dateStr) return "-";

  const d = new Date(dateStr);

  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ============================================
// EMAIL TEMPLATE BUILDER
// ============================================

export const buildHotelBookingEmail = (order) => {
  const hotelData = order?.bookingPayload?.hotelData;
  const hotel = hotelData?.hotelDetails?.hotel;
  const roomData = hotelData?.hotelDetails?.room;
  const rooms = roomData?.Rooms || [];
  const rateConditions = roomData?.RateConditions || [];
  const searchParams = hotelData?.hotelDetails?.searchParams || [];

  // Actual booking stay dates
  const checkInDate = hotelData?.hotelDetails?.CheckIn;
  const checkOutDate = hotelData?.hotelDetails?.CheckOut;

  // Status & References
  const confirmationNumber = order?.orderData?.ConfirmationNumber;
  const clientReference = order?.orderData?.data?.ClientReferenceId;
  const status = order?.status;
  const invoiceId = order?.invoiceId;
  const paymentId = order?.paymentId;
  const totalAmount = order?.InvoiceValue;
  const createdAt = order?.createdAt;

  // Guest info
  const customerDetails = hotelData?.CustomerDetails || [];
  const customers = customerDetails.flatMap(
    (room) => room.CustomerNames || []
  );
  const adults = customers.filter((c) => c.Type === "Adult");
  const children = customers.filter((c) => c.Type === "Child");
  const adultCount = adults.length;
  const childCount = children.length;
  const guest = customers[0] || null;
  const guestName = guest
    ? `${guest.Title} ${guest.FirstName} ${guest.LastName}`
    : "Guest";
  const email = hotelData?.EmailId;
  const phone = hotelData?.PhoneNumber;

  // Price
  const totalFare =
    hotelData?.TotalFare ??
    rooms.reduce((sum, r) => sum + Number(r.TotalFare || 0), 0) ??
    totalAmount ??
    0;
  const totalTax =
    rooms.reduce((sum, r) => sum + Number(r.TotalTax || 0), 0) ?? 0;
  const currency = roomData?.Currency || "SAR";

  // Hotel image
  const hotelImage = hotel?.Image || hotel?.Images?.[0] || "";

  // Colors
  const statusColor =
    status === "CONFIRMED"
      ? "#4CAF50"
      : status === "CANCELLED"
        ? "#f44336"
        : "#FF9800";
  const roomCount = rooms.length || customerDetails.length || 0;
  const hotelDescription = stripHtml(hotel?.Description);

  // ============================================
  // ROOM DETAILS HTML
  // ============================================
  let roomsHtml = "";
  rooms.forEach((room) => {
    const roomName = Array.isArray(room.Name)
      ? room.Name.join(", ")
      : room.Name || "Room";

    const dayRatesHtml =
      room.DayRates?.length > 0
        ? room.DayRates.flatMap((rateGroup) =>
          rateGroup.map(
            (rate, ri) => `
            <tr>
              <td style="padding:8px 12px; font-size:13px; color:#64748b;">Rate ${ri + 1}</td>
              <td style="padding:8px 12px; font-size:13px; font-weight:600; color:#1e293b; text-align:right;">${Number(
              rate.BasePrice || 0
            ).toFixed(2)} ${currency}</td>
            </tr>
          `
          )
        ).join("")
        : "";

    roomsHtml += `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
        <tr>
          <td style="padding:16px; background:#f8fafc;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0; font-size:15px; font-weight:600; color:#1e293b;">${roomName}</p>
                  <p style="margin:4px 0 0 0; font-size:13px; color:#64748b;">${room.Inclusion || room.MealType || "-"
      }</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="33%" style="padding:8px 0;">
                  <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Refundability</p>
                  <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:${room.IsRefundable ? "#16a34a" : "#dc2626"
      };">${room.IsRefundable ? "Refundable" : "Non-Refundable"}</p>
                </td>
                <td width="33%" style="padding:8px 0;">
                  <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Meal</p>
                  <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${room.MealType || room.Inclusion || "-"
      }</p>
                </td>
                <td width="33%" style="padding:8px 0;">
                  <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Transfers</p>
                  <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${room.WithTransfers ? "Included" : "Not Included"
      }</p>
                </td>

              </tr>
            </table>
            ${dayRatesHtml
        ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px; border-top:1px solid #f1f5f9;">
              <tr><td colspan="2" style="padding:12px 0 8px 0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Daily Rates</td></tr>
              ${dayRatesHtml}
            </table>
            `
        : ""
      }
          </td>
        </tr>
      </table>
    `;
  });

  // ============================================
  // FACILITIES HTML
  // ============================================
  let facilitiesHtml = "";
  if (hotel?.HotelFacilities?.length > 0) {
    facilitiesHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;">
        <tr><td style="padding:16px 16px 8px 16px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Hotel Facilities</h3></td></tr>
        <tr>
          <td style="padding:0 16px 16px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${hotel.HotelFacilities.map(
      (f) => `
                <tr>
                  <td width="8" style="padding:4px 8px 4px 0; vertical-align:top;"><span style="display:inline-block; width:6px; height:6px; background:#3b82f6; border-radius:50%;"></span></td>
                  <td style="padding:4px 0; font-size:13px; color:#475569;">${f}</td>
                </tr>
              `
    ).join("")}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  // ============================================
  // ATTRACTIONS HTML
  // ============================================
  let attractionsHtml = "";
  if (hotel?.Attractions && Object.keys(hotel.Attractions).length > 0) {
    attractionsHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;">
        <tr><td style="padding:16px 16px 8px 16px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Nearby Attractions</h3></td></tr>
        <tr>
          <td style="padding:0 16px 16px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${Object.entries(hotel.Attractions)
        .map(
          ([key, val]) => `
                <tr>
                  <td style="padding:4px 0; font-size:13px; color:#475569;">${String(val)}</td>
                </tr>
              `
        )
        .join("")}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  // ============================================
  // CANCELLATION POLICIES HTML
  // ============================================
  let cancellationHtml = "";
  const hasPolicies = rooms.some((r) => r.CancelPolicies?.length > 0);
  if (hasPolicies) {
    cancellationHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;">
        <tr><td style="padding:16px 16px 8px 16px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Cancellation Policies</h3></td></tr>
        <tr>
          <td style="padding:0 16px 16px 16px;">
            ${rooms
        .flatMap((room) =>
          (room.CancelPolicies || []).map(
            (policy) => `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px; background:#f8fafc; border:1px solid #f1f5f9; border-radius:6px;">
                <tr>
                  <td style="padding:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <p style="margin:0; font-size:13px; font-weight:600; color:#1e293b;">${formatCancellationDate(
              policy.FromDate
            )}</p>
                          <p style="margin:2px 0 0 0; font-size:11px; color:#94a3b8;">${policy.ChargeType
              }</p>
                        </td>
                        <td style="text-align:right;">
                          <p style="margin:0; font-size:14px; font-weight:700; color:#374151;">
                            ${policy.ChargeType === "Percentage"
                ? `${policy.CancellationCharge}%`
                : `${Number(
                  policy.CancellationCharge || 0
                ).toFixed(2)} ${currency}`
              }
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            `
          )
        )
        .join("")}
          </td>
        </tr>
      </table>
    `;
  }

  // ============================================
  // HOTEL FEES HTML
  // ============================================
  let feesHtml = "";
  if (hotel?.HotelFees) {
    const optionalFees = hotel.HotelFees.Optional || [];
    const mandatoryFees = hotel.HotelFees.Mandatory || [];
    if (optionalFees.length > 0 || mandatoryFees.length > 0) {
      feesHtml = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;">
          <tr><td style="padding:16px 16px 8px 16px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Hotel Fees</h3></td></tr>
          <tr>
            <td style="padding:0 16px 16px 16px;">
              ${optionalFees
          .map(
            (fee) => `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px; background:#f8fafc; border-radius:6px;">
                  <tr>
                    <td style="padding:12px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td>
                            <p style="margin:0; font-size:13px; font-weight:600; color:#1e293b;">${fee.FeesType}</p>
                            <p style="margin:2px 0 0 0; font-size:11px; color:#94a3b8;">${fee.ChargeType}</p>
                          </td>
                          <td style="text-align:right;">
                            <p style="margin:0; font-size:14px; font-weight:700; color:#374151;">${fee.FeesValue} ${fee.Currency}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              `
          )
          .join("")}
              ${mandatoryFees
          .map(
            (fee) => `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px; background:#fef2f2; border-radius:6px;">
                  <tr>
                    <td style="padding:12px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td>
                            <p style="margin:0; font-size:13px; font-weight:600; color:#1e293b;">${fee.FeesType}</p>
                            <p style="margin:2px 0 0 0; font-size:11px; color:#dc2626;">Mandatory</p>
                          </td>
                          <td style="text-align:right;">
                            <p style="margin:0; font-size:14px; font-weight:700; color:#374151;">${fee.FeesValue} ${fee.Currency}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              `
          )
          .join("")}
            </td>
          </tr>
        </table>
      `;
    }
  }

  // ============================================
  // GUESTS HTML
  // ============================================
  const guestsHtml = customers
    .map(
      (customer) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px; background:#f8fafc; border-radius:6px;">
      <tr>
        <td style="padding:12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <span style="display:inline-block; width:24px; height:24px; background:#dbeafe; color:#1d4ed8; border-radius:50%; text-align:center; line-height:24px; font-size:12px; font-weight:600; margin-right:8px;">&#128100;</span>
                <span style="font-size:13px; font-weight:600; color:#1e293b;">${customer.Title} ${customer.FirstName} ${customer.LastName}</span>
              </td>
              <td style="text-align:right;">
                <span style="font-size:11px; color:#94a3b8;">${customer.Type}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
    )
    .join("");

  // ============================================
  // SEARCH PARAMS HTML
  // ============================================
  let searchHtml = "";
  if (searchParams.length > 0) {
    searchHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;">
        <tr><td style="padding:16px 16px 8px 16px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Search Details</h3></td></tr>
        <tr>
          <td style="padding:0 16px 16px 16px;">
            ${searchParams
        .map(
          (params, index) => `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px; background:#f8fafc; border-radius:6px;">
                <tr><td style="padding:12px 12px 4px 12px; font-size:13px; font-weight:600; color:#1e293b;">Room ${index + 1}</td></tr>
                <tr>
                  <td style="padding:0 12px 12px 12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="33%">
                          <p style="margin:0; font-size:11px; color:#94a3b8;">Adults</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${params.Adults ?? 0
            }</p>
                        </td>
                        <td width="33%">
                          <p style="margin:0; font-size:11px; color:#94a3b8;">Children</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${params.Children ?? 0
            }</p>
                        </td>
                        <td width="33%">
                          <p style="margin:0; font-size:11px; color:#94a3b8;">Children Ages</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${params.ChildrenAges?.length
              ? params.ChildrenAges.join(", ")
              : "-"
            }</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            `
        )
        .join("")}
          </td>
        </tr>
      </table>
    `;
  }


  // ============================================
  // FULL EMAIL HTML
  // ============================================
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hotel Booking Confirmation</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); padding:32px 24px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700;">&#127976; Hotel Booking Confirmation</h1>
              <p style="margin:8px 0 0 0; color:#dbeafe; font-size:14px;">Thank you for your booking, ${guestName}!</p>
            </td>
          </tr>

          <!-- STATUS BAR -->
          <tr>
            <td style="padding:16px 24px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="display:inline-block; padding:6px 16px; background:${statusColor}15; color:${statusColor}; border-radius:9999px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
                      ${status || "PENDING"}
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <span style="font-size:12px; color:#64748b;">Invoice: <strong style="color:#1e293b;">${invoiceId || "N/A"
    }</strong></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- HOTEL IMAGE & NAME -->
          ${hotelImage
      ? `
          <tr>
            <td style="position:relative;">
              <img src="${hotelImage}" alt="${hotel?.HotelName || "Hotel"
      }" style="width:100%; height:280px; object-fit:cover; display:block;" />
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:20px 24px; background:linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%);">
                    <h2 style="margin:0; color:#ffffff; font-size:22px; font-weight:700;">${hotel?.HotelName || "Hotel"
      }</h2>
                    ${hotel?.CityName
        ? `<p style="margin:4px 0 0 0; color:#e2e8f0; font-size:13px;">&#128205; ${hotel.CityName}${hotel.CountryName ? `, ${hotel.CountryName}` : ""
        }</p>`
        : ""
      }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
      : `
          <tr>
            <td style="padding:24px; border-bottom:1px solid #e2e8f0;">
              <h2 style="margin:0; color:#1e293b; font-size:22px; font-weight:700;">${hotel?.HotelName || "Hotel"
      }</h2>
              ${hotel?.CityName
        ? `<p style="margin:4px 0 0 0; color:#64748b; font-size:13px;">&#128205; ${hotel.CityName}${hotel.CountryName ? `, ${hotel.CountryName}` : ""
        }</p>`
        : ""
      }
            </td>
          </tr>
          `
    }

          <!-- MAIN CONTENT -->
          <tr>
            <td style="padding:24px;">

              <!-- RATING & ADDRESS -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td>
                    ${hotel?.HotelRating !== undefined
      ? `
                    <p style="margin:0 0 8px 0; font-size:14px;">
                      <span style="color:#f59e0b;">${"&#9733;".repeat(
        Math.min(Number(hotel.HotelRating) || 0, 5)
      )}</span>
                      <span style="color:#64748b; font-size:12px; margin-left:4px;">${hotel.HotelRating} Stars</span>
                    </p>
                    `
      : ""
    }
                    ${hotel?.Address
      ? `
                    <p style="margin:0; font-size:13px; color:#475569;">&#128205; ${hotel.Address}${hotel.CityName ? `, ${hotel.CityName}` : ""
      }${hotel.CountryName ? `, ${hotel.CountryName}` : ""}</p>
                    `
      : ""
    }
                  </td>
                  <td style="text-align:right; vertical-align:top;">
                    <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Total Price</p>
                    <p style="margin:4px 0 0 0; font-size:24px; font-weight:700; color:#1d4ed8;">${Number(
      order.InvoiceValue
    ).toFixed(2)} ${currency}</p>
                    ${totalTax > 0
      ? `<p style="margin:4px 0 0 0; font-size:11px; color:#94a3b8;">Tax: ${Number(
        totalTax
      ).toFixed(2)} ${currency}</p>`
      : ""
    }
                  </td>
                </tr>
              </table>

              <!-- BOOKING SUMMARY GRID -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td width="25%" style="padding:8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                      <tr><td style="padding:16px; text-align:center;">
                        <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Rooms</p>
                        <p style="margin:8px 0 0 0; font-size:18px; font-weight:700; color:#1e293b;">${roomCount}</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="25%" style="padding:8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                      <tr><td style="padding:16px; text-align:center;">
                        <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Adults</p>
                        <p style="margin:8px 0 0 0; font-size:18px; font-weight:700; color:#1e293b;">${adultCount}</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="25%" style="padding:8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                      <tr><td style="padding:16px; text-align:center;">
                        <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Children</p>
                        <p style="margin:8px 0 0 0; font-size:18px; font-weight:700; color:#1e293b;">${childCount}</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="25%" style="padding:8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                      <tr><td style="padding:16px; text-align:center;">
                        <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Meal</p>
                        <p style="margin:8px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${rooms[0]?.MealType || rooms[0]?.Inclusion || "-"
    }</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ROOM DETAILS -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr><td style="padding-bottom:12px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Room Details</h3></td></tr>
                <tr><td>${roomsHtml}</td></tr>
              </table>

     <!-- CHECK IN / CHECK OUT -->
<table
  role="presentation"
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;"
>
  <tr>
    <td style="padding:16px 16px 8px 16px;">
      <h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">
        Check-in / Check-out
      </h3>
    </td>
  </tr>

  <tr>
    <td style="padding:0 16px 16px 16px;">
      <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
      >
        <tr>

          <!-- CHECK IN -->
          <td width="50%" style="padding:8px;">
            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="background:#f8fafc; border-radius:8px;"
            >
              <tr>
                <td style="padding:16px;">

                  <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">
                    Check-in
                  </p>

                  <!-- Actual booking date -->
                  <p style="margin:8px 0 0 0; font-size:16px; font-weight:700; color:#1e293b;">
                    ${formatStayDate(checkInDate)}
                  </p>

                  <!-- Hotel check-in time -->
                  ${hotel?.CheckInTime
      ? `
                        <p style="margin:4px 0 0 0; font-size:12px; color:#64748b;">
                          Check-in time: ${hotel.CheckInTime}
                        </p>
                      `
      : ""
    }

                </td>
              </tr>
            </table>
          </td>

          <!-- CHECK OUT -->
          <td width="50%" style="padding:8px;">
            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="background:#f8fafc; border-radius:8px;"
            >
              <tr>
                <td style="padding:16px;">

                  <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">
                    Check-out
                  </p>

                  <!-- Actual booking date -->
                  <p style="margin:8px 0 0 0; font-size:16px; font-weight:700; color:#1e293b;">
                    ${formatStayDate(checkOutDate)}
                  </p>

                  <!-- Hotel check-out time -->
                  ${hotel?.CheckOutTime
      ? `
                        <p style="margin:4px 0 0 0; font-size:12px; color:#64748b;">
                          Check-out time: ${hotel.CheckOutTime}
                        </p>
                      `
      : ""
    }

                </td>
              </tr>
            </table>
          </td>

        </tr>
      </table>
    </td>
  </tr>
</table>

              <!-- HOTEL INFORMATION -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;">
                <tr><td style="padding:16px 16px 8px 16px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Hotel Information</h3></td></tr>
                <tr>
                  <td style="padding:0 16px 16px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                     <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Country</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${hotel?.CountryName || "-"
    }</p>
                        </td>
                        <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Rating</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${hotel?.HotelRating || "-"
    } Stars</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">City</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${hotel?.CityName || "-"
    }</p>
                        </td>
                      </tr>
                      <tr>

                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- FACILITIES -->
              ${facilitiesHtml}

              <!-- ATTRACTIONS -->
              ${attractionsHtml}

              <!-- CANCELLATION POLICIES -->
              ${cancellationHtml}

              <!-- HOTEL FEES -->
              ${feesHtml}

        

              <!-- GUEST INFORMATION -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;">
                <tr><td style="padding:16px 16px 8px 16px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Guest Information</h3></td></tr>
                <tr><td style="padding:0 16px 16px 16px;">${guestsHtml}</td></tr>
              </table>

              <!-- BOOKING INFORMATION -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;">
                <tr><td style="padding:16px 16px 8px 16px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Booking Information</h3></td></tr>
                <tr>
                  <td style="padding:0 16px 16px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Confirmation Number</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${confirmationNumber || "-"
    }</p>
                        </td>

                           <td colspan="2" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Created At</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${formatStayDate(
      createdAt
    )}</p>
                           </td>
    
                      </tr>
                      <tr>
                        <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Booking Reference</p>
                          <p style="margin:4px 0 0 0; font-size:12px; font-family:monospace; color:#475569; word-break:break-all;">${hotelData?.BookingReferenceId || "-"
    }</p>
                        </td>
  

                       <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Booking Type</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${hotelData?.BookingType || "-"
    }</p>
                        </td>


                      </tr>
                      <tr>
                        <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Invoice ID</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${invoiceId || "-"
    }</p>
                        </td>
                        <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Payment ID</p>
                          <p style="margin:4px 0 0 0; font-size:11px; font-family:monospace; color:#475569; word-break:break-all;">${paymentId || "-"
    }</p>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Payment Mode</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${hotelData?.PaymentMode || "-"
    }</p>
                        </td>
 
                      </tr>
                      <tr>
 
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CONTACT INFORMATION -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px;">
                <tr><td style="padding:16px 16px 8px 16px;"><h3 style="margin:0; font-size:16px; font-weight:600; color:#1e293b;">Contact Information</h3></td></tr>
                <tr>
                  <td style="padding:0 16px 16px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Booking Email</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b; word-break:break-all;">${hotelData?.EmailId || "-"
    }</p>
                        </td>
                        <td width="50%" style="padding:8px 0;">
                          <p style="margin:0; font-size:11px; color:#94a3b8; text-transform:uppercase;">Booking Phone</p>
                          <p style="margin:4px 0 0 0; font-size:13px; font-weight:600; color:#1e293b;">${hotelData?.PhoneNumber || "-"
    }</p>
                        </td>
                      </tr>
                      <tr>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- SEARCH DETAILS -->
              ${searchHtml}


            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc; padding:24px; text-align:center; border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px 0; font-size:13px; color:#64748b;">If you have any questions, feel free to contact our support.</p>
              <p style="margin:0; font-size:12px; color:#94a3b8;">&copy; ${new Date().getFullYear()} Tayyran App. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};



const sendEmail = async (options) => {
  // 1) Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
    logger: process.env.EMAIL_LOGGER === 'true',
    debug: process.env.EMAIL_DEBUG === 'true',
  })

  // 2) Define email options using template literals if needed
  const mailOpts = {
    from: `Tayyran App <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
    text: options.text || options.message.replace(/<[^>]*>/g, ""),
  };

  // 3) Send email
  try {

    await transporter.verify();
    console.log("SMTP connection verified");

    const result = await transporter.sendMail(mailOpts);
    console.log(`Email sent to ${options.email}`, result);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error; // Re-throw to handle in calling function
  }
};

export default sendEmail;
