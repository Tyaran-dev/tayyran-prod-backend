import { hotelsConnection } from '../db/connectMongoDB.js'; // Import hotels connection
import { cities } from './cities.js'; // Your Hotel model
import City from "../models/hotelsDB/City.model.js"

// Main seeding function
const seedHotels = async () => {
    try {
        console.log('Starting hotel data seeding...');

        // Wait for hotels database connection
        await hotelsConnection.asPromise();
        console.log('✅ Connected to Hotels database');

        // Optional: Clear existing data
        await City.deleteMany({});
        console.log('🗑️  Cleared existing hotel data');

        // Insert new data
        const result = await City.insertMany(cities);
        console.log(`✅ ${result.length} hotels inserted successfully`);

        // Display inserted hotels
        console.log('\n📋 Inserted cities:');
     

        console.log('\n✅ cities seeding completed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding cities data:', error.message);
        console.error(error);
        process.exit(1);
    }
};

// Run the seed function
seedHotels();