import { Schema } from 'mongoose';
import { hotelsConnection } from "../../db/connectMongoDB.js"; // Import your specific connection

const citySchema = new Schema({
    Code: {
        type: String,
        required: true
    },
    Name: {
        type: String,
        required: true
    },
    name_ar: {
        type: String,
        required: true
    }
});


const City = hotelsConnection.model("City", citySchema);
export default City;