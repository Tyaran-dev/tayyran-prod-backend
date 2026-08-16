const axios = require('axios');

const testData = {
    "bookingData": {
        "order": {
            "status": "CONFIRMED",
            "invoiceId": "INV-12345",
            "InvoiceValue": 550.00,
            "bookingPayload": {
                "hotelData": {
                    "EmailId": "hashimsalahalden5@gmail.com",
                    "PhoneNumber": "+966 50 123 4567",
                    "CustomerDetails": [
                        {
                            "CustomerNames": [
                                {
                                    "Title": "Mr.",
                                    "FirstName": "John",
                                    "LastName": "Doe"
                                }
                            ]
                        }
                    ]
                }
            },
            "orderData": {
                "data": {
                    "ConfirmationNumber": "CONF-9876",
                    "ClientReferenceId": "REF-5555"
                }
            }
        }
    }
};

// Adjust the URL if your server is running on a different port
const url = 'http://localhost:5000/api/hotels/send-booking-email';

axios.post(url, testData)
    .then(response => {
        console.log("Success:", response.data);
    })
    .catch(error => {
        console.error("Error:", error.response ? error.response.data : error.message);
    });
