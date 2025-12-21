import axios from "axios";
import { ApiError } from "../../utils/apiError.js";

const presentageCommission = 5;

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = `0${date.getMonth() + 1}`.slice(-2);
  const day = `0${date.getDate()}`.slice(-2);
  return `${year}-${month}-${day}`;
};

export const getCountryList = async (req, res, next) => {
  try {
    const userName = process.env.TBO_LIVE_USER_NAME,
      password = process.env.TBO_LIVE_PASSWORD,
      baseURL = process.env.TBO_LIVE_URL;

    const reponse = await axios.get(`${baseURL}/CountryList`, {
      auth: {
        username: userName,
        password: password,
      },
    });
    return res.status(200).json({ data: reponse.data.CountryList });
  } catch (error) {
    next(
      new ApiError(
        error.response?.status || 500,
        error.response?.data?.errors?.[0]?.detail ||
          "Error searching for countries"
      )
    );
  }
};

export const getCityList = async (req, res, next) => {
  try {
    const userName = process.env.TBO_LIVE_USER_NAME,
      password = process.env.TBO_LIVE_PASSWORD,
      baseURL = process.env.TBO_LIVE_URL;

    const { CountryCode } = req.body;

    const reponse = await axios.post(
      `${baseURL}/CityList`,
      {
        CountryCode,
      },
      {
        auth: {
          username: userName,
          password: password,
        },
      }
    );
    return res.status(200).json({ data: reponse.data.CityList });
  } catch (error) {
    next(
      new ApiError(
        error.response?.status || 500,
        error.response?.data?.errors?.[0]?.detail ||
          "Error searching for cities"
      )
    );
  }
};

const PER_PAGE = 30;
// === Helper: split array into chunks ===
const chunkArray = (array, size) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

// === Helper: limit concurrency ===
const pLimit = (concurrency) => {
  const queue = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) queue.shift()();
  };

  const run = async (fn, resolve, args) => {
    activeCount++;
    const result = (async () => fn(...args))();
    result.then(resolve).then(next, next);
  };

  const enqueue = (fn, args) =>
    new Promise((resolve) => {
      queue.push(run.bind(null, fn, resolve, args));
      if (activeCount < concurrency) {
        queue.shift()();
      }
    });

  return (fn, ...args) => enqueue(fn, args);
};

// === Main Controller ===
export const hotelsSearch = async (req, res, next) => {
  try {
    const userName = process.env.TBO_LIVE_USER_NAME,
      password = process.env.TBO_LIVE_PASSWORD,
      baseURL = process.env.TBO_LIVE_URL;

    const {
      CheckIn,
      CheckOut,
      CityCode,
      GuestNationality,
      PreferredCurrencyCode = "SAR",
      PaxRooms,
      Language = "EN",
      page = 1,
    } = req.body;

    // Step 0: Basic validation
    if (!CityCode || !CheckIn || !CheckOut || !PaxRooms || !GuestNationality) {
      return next(
        new ApiError(400, "Missing required fields for hotel search")
      );
    }

    // Step 1: Fetch hotel codes for the city
    const hotelCodesRes = await axios.post(
      `${baseURL}/TBOHotelCodeList`,
      { CityCode },
      { auth: { username: userName, password } }
    );

    const allHotelCodes =
      hotelCodesRes.data?.Hotels?.map((h) => h.HotelCode) || [];

    if (allHotelCodes.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No hotel codes found for the selected city.",
      });
    }

    // Step 2: Fetch available rooms in hotels (batched + concurrent)
    const limit = pLimit(10); // max 10 parallel requests
    const hotelChunks = chunkArray(allHotelCodes, 50); // each request ≤ 50 codes
    const batchChunks = chunkArray(hotelChunks, 10); // group 10x50 = 500 per cycle

    let searchResults = [];
    for (const batch of batchChunks) {
      const results = await Promise.all(
        batch.map((codes, indx) => {
          return limit(() =>
            axios.post(
              `${baseURL}/Search`,
              {
                CheckIn: formatDate(CheckIn),
                CheckOut: formatDate(CheckOut),
                HotelCodes: codes.join(","), // max 50
                GuestNationality,
                PreferredCurrencyCode,
                PaxRooms,
                ResponseTime: 23.0,
                IsDetailedResponse: true,
                Filters: {
                  Refundable: false,
                  NoOfRooms: 20,
                  MealType: "All",
                },
              },
              {
                auth: { username: userName, password },
              }
            )
          );
        })
      );

      const batchResults = results.flatMap((r) => r.data?.HotelResult || []);
      searchResults = [...searchResults, ...batchResults];
    }

    const aviailableHotelCodes = searchResults.map((r) => r.HotelCode);

    // Step 3: Paginate available hotel codes
    const startIndex = (page - 1) * PER_PAGE;
    const currentBatchArray = aviailableHotelCodes.slice(
      startIndex,
      startIndex + PER_PAGE
    );

    if (currentBatchArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No hotels found for page ${page}.`,
      });
    }

    const currentBatch = currentBatchArray.join(",");

    // Step 4: Fetch hotel details
    const hotelDetailsRes = await axios.post(
      `${baseURL}/HotelDetails`,
      { Hotelcodes: currentBatch, Language },
      { auth: { username: userName, password } }
    );

    const hotelDetails = hotelDetailsRes.data?.HotelDetails || [];

    // Step 5: Merge hotel details with pricing
    const enrichedHotels = hotelDetails.map((hotel) => {
      const matched = searchResults.find(
        (result) => result.HotelCode === hotel.HotelCode
      );
      return {
        ...hotel,
        ...matched,
        MinHotelPrice:
          matched?.Rooms?.[0]?.DayRates?.[0]?.[0]?.BasePrice || null,
        presentageCommission,
      };
    });

    // Step 6: Return results
    return res.status(200).json({
      success: true,
      data: enrichedHotels,
      pagination: {
        page,
        perPage: PER_PAGE,
        total: aviailableHotelCodes.length,
        totalPages: Math.ceil(aviailableHotelCodes.length / PER_PAGE),
      },
    });
  } catch (error) {
    console.error(
      "Hotel search error:",
      error?.response?.data || error.message
    );
    next(
      new ApiError(
        error.response?.status || 500,
        error.response?.data?.errors?.[0]?.detail ||
          "Error searching for hotels"
      )
    );
  }
};

export const getHotelDetails = async (req, res, next) => {
  try {
    const userName = process.env.TBO_LIVE_USER_NAME,
      password = process.env.TBO_LIVE_PASSWORD,
      baseURL = process.env.TBO_LIVE_URL;
    const {
      CheckIn,
      CheckOut,
      CityCode,
      HotelCodes,
      GuestNationality,
      PreferredCurrencyCode = "SAR",
      PaxRooms,
      Language = "EN",
    } = req.body;

    if (!HotelCodes) {
      return next(new ApiError(400, "Hotel codes are required"));
    }

    const hotelSearchPayload = {
      CheckIn: formatDate(CheckIn),
      CheckOut: formatDate(CheckOut),
      CityCode,
      HotelCodes,
      GuestNationality,
      PreferredCurrencyCode,
      PaxRooms,
      ResponseTime: 23.0,
      IsDetailedResponse: true,
      Filters: {
        Refundable: false,
        NoOfRooms: 50,
        MealType: "All",
      },
    };

    const hotelDetails = await axios.post(
      `${baseURL}/HotelDetails`,
      { HotelCodes, Language },
      {
        auth: {
          username: userName,
          password,
        },
      }
    );

    const hotel = hotelDetails.data.HotelDetails;

    const getRooms = await axios.post(`${baseURL}/Search`, hotelSearchPayload, {
      auth: { username: userName, password },
    });

    const availableRooms = getRooms.data?.HotelResult[0].Rooms || [];
    // console.log(availableRooms, "avilaible rooooooooms")

    return res.status(200).json({
      data: {
        hotel,
        availableRooms,
        presentageCommission,
      },
    });
  } catch (error) {
    next(
      new ApiError(
        error.response?.status || 500,
        error.response?.data?.errors?.[0]?.detail ||
          "Error searching for Hotel Details "
      )
    );
  }
};

export const preBookRoom = async (req, res, next) => {
  try {
    const userName = process.env.TBO_LIVE_USER_NAME,
      password = process.env.TBO_LIVE_PASSWORD,
      baseURL = process.env.TBO_LIVE_URL,
      { BookingCode } = req.body;

    const response = await axios.post(
      `${baseURL}/PreBook`,
      {
        BookingCode,
        PaymentMode: "NewCard",
      },
      { auth: { username: userName, password } }
    );

    return res.status(200).json({
      data: response.data,
    });
  } catch (error) {
    next(
      new ApiError(
        error.response?.status || 500,
        error.response?.data?.errors?.[0]?.detail ||
          "Error searching for Hotel Details "
      )
    );
  }
};

export const bookRoom = async (req, res, next) => {
  try {
    const userName = process.env.TBO_LIVE_USER_NAME,
      password = process.env.TBO_LIVE_PASSWORD,
      baseURL = process.env.TBO_LIVE_URL;

    const {
      BookingCode,
      CustomerDetails,
      ClientReferenceId,
      BookingReferenceId,
      TotalFare,
      EmailId,
      PhoneNumber,
      BookingType,
      PaymentMode,
      Supplements, // optional
    } = req.body;

    // Compose the request payload
    const payload = {
      BookingCode,
      CustomerDetails,
      ClientReferenceId,
      BookingReferenceId,
      TotalFare,
      EmailId,
      PhoneNumber,
      BookingType,
      PaymentMode,
    };

    if (Supplements && Supplements.length > 0) {
      payload.Supplements = Supplements;
    }

    const response = await axios.post(`${baseURL}/Book`, payload, {
      auth: { username: userName, password },
    });

    return res.status(200).json({
      success: true,
      message: "Booking successful",
      data: response.data,
    });
  } catch (error) {
    next(
      new ApiError(
        error.response?.status || 500,
        error.response?.data?.errors?.[0]?.detail ||
          "Error searching for Hotel Details"
      )
    );
  }
};

export const BookingDetails = async (req, res, next) => {
  try {
    const userName = process.env.TBO_LIVE_USER_NAME,
      password = process.env.TBO_LIVE_PASSWORD,
      baseURL = process.env.TBO_LIVE_URL;

    const { BookingReferenceId } = req.body;

    if (!BookingReferenceId) {
      return res.status(400).json({
        success: false,
        message: "BookingReferenceId is required",
      });
    }

    const detailsResponse = await axios.post(
      `${baseURL}/BookingDetail`,
      {
        BookingReferenceId: BookingReferenceId,
        PaymentMode: "PayLater", // or the mode you actually use
      },
      {
        auth: {
          username: userName,
          password: password,
        },
      }
    );

    // forward TBO API response to client
    return res.status(200).json({
      success: true,
      data: detailsResponse.data,
    });
  } catch (error) {
    console.error("BookingDetails error:", error?.response?.data || error);

    return next(
      new ApiError(
        error.response?.status || 500,
        error.response?.data?.errors?.[0]?.detail ||
          error.response?.data?.error ||
          "Error fetching booking details from TBO"
      )
    );
  }
};
export const getRandomHotels = async (req, res, next) => {
  try {
    const userName = process.env.TBO_LIVE_USER_NAME;
    const password = process.env.TBO_LIVE_PASSWORD;
    const baseURL = process.env.TBO_LIVE_URL;

    const { cities } = req.body;
    const cityList = Array.isArray(cities) ? cities : cities.split(",");

    const stayDays = [2, 3, 4];
    const today = new Date();
    const checkIn = new Date(today);
    checkIn.setDate(today.getDate() + 30);

    const formatDate = (date) => date.toISOString().split("T")[0];

    const availableHotels = [];

    for (const cityCode of cityList) {
      // Step 1️⃣: Fetch hotel codes in the city
      const hotelCodesRes = await axios.post(
        `${baseURL}/TBOHotelCodeList`,
        { CityCode: cityCode },
        { auth: { username: userName, password } }
      );

      const hotels = hotelCodesRes.data?.Hotels || [];

      if (!hotels.length) {
        console.log(`❌ No hotels found for city ${cityCode}`);
        continue;
      }

      // Step 2️⃣: Pick a random hotel and search for availability
      let selectedHotel = null;
      let tries = 0;

      while (!selectedHotel && tries < 3) {
        tries++;
        const randomHotel = hotels[Math.floor(Math.random() * hotels.length)];
        const randomStay =
          stayDays[Math.floor(Math.random() * stayDays.length)];
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkIn.getDate() + randomStay);

        const payload = {
          CheckIn: formatDate(checkIn),
          CheckOut: formatDate(checkOut),
          HotelCodes: randomHotel.HotelCode,
          GuestNationality: "US",
          PaxRooms: [{ Adults: 2, Children: 0, ChildrenAges: [] }],
          ResponseTime: 23.0,
          IsDetailedResponse: true,
          Filters: { Refundable: false, NoOfRooms: 20, MealType: "All" },
        };

        try {
          const searchRes = await axios.post(`${baseURL}/Search`, payload, {
            auth: { username: userName, password },
          });

          const hotelsFound = searchRes.data?.HotelResult || [];

          if (hotelsFound.length > 0) {
            selectedHotel = {
              cityCode,
              hotelCode: randomHotel.HotelCode,
              hotelName: randomHotel.HotelName,
              stay: randomStay,
              checkIn: formatDate(checkIn),
              checkOut: formatDate(checkOut),
              rooms: hotelsFound[0]?.Rooms || [],
            };
            availableHotels.push(selectedHotel);
          } else {
            console.log(
              `❌ No available rooms for hotel ${randomHotel.HotelCode}`
            );
          }
        } catch (searchError) {
          console.error(
            `🚨 Search error for hotel ${randomHotel.HotelCode}:`,
            searchError.message
          );
        }
      }

      if (!selectedHotel) {
        console.log(
          `💥 Failed to find available hotel for city ${cityCode} after 3 attempts`
        );
      }
    }

    if (availableHotels.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No hotels found with available rooms.",
      });
    }

    // Step 3️⃣: Get details for the selected hotels
    const hotelCodes = availableHotels.map((h) => h.hotelCode).join(",");

    const hotelDetailsRes = await axios.post(
      `${baseURL}/HotelDetails`,
      { Hotelcodes: hotelCodes, Language: "EN" },
      { auth: { username: userName, password } }
    );

    const detailedHotels = hotelDetailsRes.data?.HotelDetails || [];
    console.log(`📄 Retrieved details for ${detailedHotels.length} hotels`);

    // Step 4️⃣: Merge details with availability
    const merged = availableHotels.map((avail) => {
      const detail = detailedHotels.find(
        (d) => d.HotelCode === avail.hotelCode
      );
      return { ...avail, ...detail };
    });

    return res.status(200).json({
      success: true,
      count: merged.length,
      data: merged,
    });
  } catch (error) {
    console.error("❌ getRandomHotels error:", error.response?.data || error);
    return next(
      new ApiError(
        error.response?.status || 500,
        error.response?.data?.errors?.[0]?.detail ||
          error.response?.data?.error ||
          "Error fetching random hotels from TBO"
      )
    );
  }
};
