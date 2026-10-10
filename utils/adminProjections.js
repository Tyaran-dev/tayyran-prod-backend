

export const USER_LIST_FIELDS =
    "_id name email role membershipStatus emailVerified createdAt";

export const USER_DETAIL_EXCLUDE_FIELDS =
    "-password -resetCode -resetCodeExpires -verificationCode -verificationCodeExpires -passport";



export const BOOKING_LIST_FIELDS =
    "_id invoiceId status bookingType InvoiceValue paymentId user createdAt";
