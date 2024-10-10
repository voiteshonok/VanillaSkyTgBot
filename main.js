import TelegramBot from 'node-telegram-bot-api';

import { Database, Flight } from './db.js';
import axios from 'axios';
import crypto from 'crypto';

const db = new Database();

const id2city = {
    1: 'Tbilisi',
    2: 'Ambrolauri',
    4: 'Batumi',
    5: 'Kutaisi',
    6: 'Mestia',
    7: 'Natakhtari',
    8: 'Aktau'
};

class App {
    constructor(){
        this.db = db;
    }

    async subscribe(chatId, fromCityId, toCityId) {
        try {
            // Log the subscription attempt
            console.log('Subscribing user:', chatId, 'from', fromCityId, 'to', toCityId);

            // Check if the subscription already exists
            const { data: existingSubscriptions, error: checkError } = await this.db.client
                .from('subscriptions')
                .select('*')
                .eq('chat_id', chatId)
                .eq('from_destination_id', fromCityId)
                .eq('to_destination_id', toCityId);

            if (checkError) {
                console.error('Error while checking subscription:', checkError);
                return { success: false, message: 'Error checking subscription', error: checkError };
            }

            // If a subscription already exists, return a message
            if (existingSubscriptions.length > 0) {
                console.log('Subscription already exists:', existingSubscriptions);
                return { success: false, message: 'User already subscribed to this route' };
            }

            // If no subscription exists, insert a new one
            const { data, error } = await this.db.client
                .from('subscriptions')
                .insert([
                    { 
                        chat_id: chatId, 
                        from_destination_id: fromCityId, 
                        to_destination_id: toCityId 
                    }
                ]);

            // Handle errors during the insertion
            if (error) {
                console.error('Error while subscribing:', error);
                return { success: false, message: 'Subscription failed', error };
            }

            console.log('Subscription successful:', data);
            return { success: true, message: 'Subscription successful', data };

        } catch (err) {
            console.error('Unexpected error:', err);
            return { success: false, message: 'An unexpected error occurred', error: err };
        }
    }

    async unsubscribe(chatId, fromCityId, toCityId) {
        try {
            // Log the unsubscribe attempt
            console.log('Unsubscribing user:', chatId, 'from', fromCityId, 'to', toCityId);

            // Check if the subscription exists
            const { data: existingSubscriptions, error: checkError } = await this.db.client
                .from('subscriptions')
                .select('*')
                .eq('chat_id', chatId)
                .eq('from_destination_id', fromCityId)
                .eq('to_destination_id', toCityId);

            if (checkError) {
                console.error('Error while checking subscription:', checkError);
                return { success: false, message: 'Error checking subscription', error: checkError };
            }

            // If no subscription exists, return a message
            if (existingSubscriptions.length === 0) {
                console.log('No subscription found to unsubscribe');
                return { success: false, message: 'No such subscription found' };
            }

            // Unsubscribe (delete the record)
            const { error } = await this.db.client
                .from('subscriptions')
                .delete()
                .eq('chat_id', chatId)
                .eq('from_destination_id', fromCityId)
                .eq('to_destination_id', toCityId);

            if (error) {
                console.error('Error while unsubscribing:', error);
                return { success: false, message: 'Unsubscription failed', error };
            }

            console.log('Unsubscription successful');
            return { success: true, message: 'Unsubscription successful' };

        } catch (err) {
            console.error('Unexpected error:', err);
            return { success: false, message: 'An unexpected error occurred', error: err };
        }
    }

    async getSubscriptions(chatId) {
        try {
            // Log the action
            console.log(`Showing subscriptions for chatId: ${chatId}`);

            // Query the database for all subscriptions for the given chatId
            const { data: subscriptions, error } = await this.db.client
                .from('subscriptions')
                .select('*')
                .eq('chat_id', chatId);

            // Handle any error during the query
            if (error) {
                console.error('Error fetching subscriptions:', error);
                return { success: false, message: 'Error fetching subscriptions', error };
            }

            // If no subscriptions found
            if (subscriptions.length === 0) {
                console.log(`No subscriptions found for chatId: ${chatId}`);
                return { success: false, message: 'No subscriptions found' };
            }

            // Log and return the subscriptions
            console.log('Subscriptions found:', subscriptions);
            return { success: true, message: 'Subscriptions retrieved successfully', subscriptions };

        } catch (err) {
            console.error('Unexpected error:', err);
            return { success: false, message: 'An unexpected error occurred', error: err };
        }
    }

    async updateFlight(fromId, toId, dates, hashOfDates) {
        try {
            // Log the update attempt
            console.log(`Updating flight from ${fromId} to ${toId}`);

            // Update the flights table with the new dates and hash of dates
            const { data, error } = await this.db.client
                .from('flights')
                .upsert({
                    from_destination_id: fromId,
                    to_destination_id: toId,
                    dates: dates,
                    hash_of_dates: hashOfDates
                })
                .eq('from_destination_id', fromId)
                .eq('to_destination_id', toId);

            // Handle errors during the update
            if (error) {
                console.error('Error updating flight:', error);
                return { success: false, message: 'Flight update failed', error };
            }

            console.log('Flight updated successfully:', data);
            await this.push(fromId, toId, dates);
            return { success: true, message: 'Flight updated successfully', data };

        } catch (err) {
            console.error('Unexpected error during update:', err);
            return { success: false, message: 'An unexpected error occurred', error: err };
        }
    }

    async push(fromId, toId, newData) {
        try {
            // Log the push event
            console.log(`Pushing data to users subscribed from ${fromId} to ${toId}`);

            // Query the database for all chatIds subscribed to the route from `fromId` to `toId`
            const { data: subscriptions, error } = await this.db.client
                .from('subscriptions')
                .select('chat_id')
                .eq('from_destination_id', fromId)
                .eq('to_destination_id', toId);

            if (error) {
                console.error('Error fetching subscriptions:', error);
                return { success: false, message: 'Error fetching subscriptions', error };
            }

            // If no subscriptions found
            if (subscriptions.length === 0) {
                console.log(`No subscriptions found for route from ${fromId} to ${toId}`);
                return { success: false, message: 'No subscriptions found for this route' };
            }

            // Loop through each subscription and send a message
            for (const subscription of subscriptions) {
                const chatId = subscription.chat_id;
                const message = `Subscribed ${fromId} to ${toId} are ${newData}`;
                
                // Sending a message to the subscribed chatId
                bot.sendMessage(chatId, message)
                    .then(() => {
                        console.log(`Message sent to chatId ${chatId}`);
                    })
                    .catch((err) => {
                        console.error(`Failed to send message to chatId ${chatId}`, err);
                    });
            }

            return { success: true, message: 'Push notifications sent to all subscribers' };

        } catch (err) {
            console.error('Unexpected error during push:', err);
            return { success: false, message: 'An unexpected error occurred', error: err };
        }
    }

    async getAllFlights() {
        try {
            // Log the retrieval attempt
            console.log('Fetching all flights from the database...');

            // Query the flights table to get all records
            const { data, error } = await this.db.client
                .from('flights')
                .select('*');

            // Handle any errors during the query
            if (error) {
                console.error('Error fetching flights:', error);
                return { success: false, message: 'Error fetching flights', error };
            }

            const flights = data.map(flightData => new Flight(flightData.from_destination_id, flightData.to_destination_id, flightData.dates, flightData.hash))
            // Log and return the retrieved data
            console.log('Flights retrieved successfully:', flights);
            return { success: true, flights: flights };

        } catch (err) {
            console.error('Unexpected error during fetching flights:', err);
            return { success: false, message: 'An unexpected error occurred', error: err };
        }
    }
}

// Backend setup
const app = new App();

// Telegram Bot setup
const bot = new TelegramBot('7234636363:AAEvtSbchRNVzaCzkbPd8OLKgaAdpEA0pjQ', { polling: true });


const commands = [
    { command: '/start', description: 'Start the bot' },
    { command: '/info', description: 'Show the info' },
    { command: '/sub', description: 'subscribe From To' },
    { command: '/unsub', description: 'unsubscribe From To' },
    { command: '/show_all_flights', description: 'show all active flights' },
    { command: '/show_my_subs', description: 'show my subscribtions' },
];
  
  // Set the commands
bot.setMyCommands(commands)
.then(() => {
    console.log('Commands registered successfully');
})
.catch((err) => {
    console.error('Failed to register commands:', err);
});

bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id;
    
    console.log(`info ${chatId}`);

    bot.sendMessage(chatId, JSON.stringify(id2city));
});
  

bot.onText(/\/sub (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const cityA = match[1]; // First city
    const cityB = match[2]; // Second city
  
    // Process the subscription
    console.log(`User ${chatId} subscribed from ${cityA} to ${cityB}`);

    app.subscribe(chatId, cityA, cityB);

    bot.sendMessage(chatId, `Subscribed from ${cityA} to ${cityB}`);
});

bot.onText(/\/unsub (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const cityA = match[1]; // First city
    const cityB = match[2]; // Second city
  
    // Process the subscription
    console.log(`User ${chatId} unsubscribed from ${cityA} to ${cityB}`);

    app.unsubscribe(chatId, cityA, cityB);

    bot.sendMessage(chatId, `Unsubscribed from ${cityA} to ${cityB}`);
});

bot.onText(/\/show_my_subs/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Get subscriptions for the specified chatId
        const response = await app.getSubscriptions(chatId);
        console.log(response);

        // Check if the response indicates success and contains data
        if (response.success && response.subscriptions && response.subscriptions.length > 0) {
            // Format the message to send
            const message = response.subscriptions.map(subscription => {
                return `From: ${subscription.from_destination_id}, To: ${subscription.to_destination_id}`;
            }).join('\n');

            // Send the message with the bot
            await bot.sendMessage(chatId, `Your subscriptions:\n${message}`);
            console.log(`Message sent to chatId ${chatId}`);
        } else {
            // Send a message indicating no subscriptions were found
            await bot.sendMessage(chatId, 'You have no subscriptions.');
            console.log(`No subscriptions found for chatId ${chatId}`);
        }
    } catch (error) {
        console.error('Error fetching subscriptions or sending message:', error);
        await bot.sendMessage(chatId, 'An error occurred while fetching your subscriptions.');
    }
});

bot.onText(/\/show_all_flights/, async (msg) => {
    const chatId = msg.chat.id; // Get the chat ID from the incoming message

    try {
        // Call the method to get all flights
        const response = await app.getAllFlights();
        
        // Check if the response is successful and contains flight data
        if (response.success && response.flights && response.flights.length > 0) {
            // Format the flight data into a message string
            for (const flight of response.flights) {
                console.log(flight);
                const flightMessage = `From: ${Destination.getNameById(flight.fromId)}, To: ${Destination.getNameById(flight.toId)}, Dates: ${flight.dates.join(', ')}`;
                
                await bot.sendMessage(chatId, flightMessage); // Await to ensure each message is sent before continuing
                console.log(`Sent flight info to chatId ${chatId}: ${flightMessage}`);
            }
        } else {
            // Inform the user that there are no flights available
            bot.sendMessage(chatId, 'No flights available at the moment.');
            console.log(`No flights found for chatId ${chatId}`);
        }
    } catch (error) {
        console.error('Error retrieving flights:', error);
        // Notify the user of the error
        bot.sendMessage(chatId, 'An error occurred while retrieving flights.');
    }
});


class Destination {
    constructor(id) {
      this.id = id;
      this.name = this.getNameById(id);
    }
  
    display() {
      console.log(`Destination ID: ${this.id}, Name: ${this.name}`);
    }

    static getNameById(destinationId) {
        return id2city[destinationId];
    }
}
  
  
async function getDestination() {
// const { data, error } = await supabase
//   .from('destination')
//   .select('*')

// if (error) {
//   console.error('Error inserting data:', error)
// } else {
//   const destinations = data.map(
//     item => new Destination(item.id, item.name)
//   )
//   destinations.forEach(destination => destination.display())
//   return destinations;
// }

return [new Destination(1),
    new Destination(2),
    new Destination(4),
    new Destination(5),
    new Destination(6),
    new Destination(7),
    new Destination(8)
]
}

// Function to sort the array and generate a hash
function getSortedArrayHash(arr) {
  const sortedArray = arr.slice().sort();

  const arrayString = JSON.stringify(sortedArray);

  const hash = crypto.createHash('sha256').update(arrayString).digest('hex');

  return hash;
}

class Scrapper {

  async getFlights(source_number, destinations) {
    // Prepare an array of promises for flight data requests
    const flightPromises = destinations.map(async (destination_number) => {
        const checkFlightUrl = `https://ticket.vanillasky.ge/custom/check-flight/${source_number}/${destination_number}`;
        
        try {
            const { data: flightData } = await axios.get(checkFlightUrl);
            const flightFromDb = await db.getFlights(source_number, destination_number);
            return { destination_number, flightData, flightFromDb};
        } catch (flightError) {
            console.error(`Error fetching flight data for ${source_number}/${destination_number}:`, flightError);
            return { destination_number, flightData: null };
        }
    });

    // Wait for all flight data promises to resolve
    const flightResults = await Promise.all(flightPromises);

    flightResults.forEach(async ({ destination_number, flightData, flightFromDb}) => {
        console.log(`Flight data for ${source_number}/${destination_number}:`, flightData.from, flightFromDb, getSortedArrayHash(flightData.from), getSortedArrayHash(flightFromDb));
        console.log();

        const dbDataHash = getSortedArrayHash(flightFromDb);
        const siteDataHash = getSortedArrayHash(flightData.from);

        if (dbDataHash !== siteDataHash) {
            await app.updateFlight(source_number, destination_number, flightData.from, siteDataHash);
        }
    });    
  }


  async checkDestination(destination) {
    try {
      const timestamp = new Date().toLocaleString();
      console.log(`Request made at: ${timestamp}`);
  
      const checkDestUrl = `https://ticket.vanillasky.ge/custom/check-dest/${destination.id}`;
      const { data: destinations } = await axios.get(checkDestUrl);
      console.log(`Data from site ${destination.id}:`, destinations);

      await this.getFlights(destination.id, destinations);

    } catch (error) {
        console.error('Error fetching data:', error);
    }
  }

  async main() {
    try {
      var destinations = await getDestination(); 
  
      if (Array.isArray(destinations)) {
        destinations.forEach(destination => this.checkDestination(destination));
      } else {
        console.error('Destinations is not an array');
      }
    } catch (error) {
      console.error('Error in main function:', error);
    }
  }
}


const scrapper = new Scrapper();

// Run all async scripts concurrently
(async () => {
    await Promise.all([
        new Promise((resolve) => {
            bot.on('polling_error', console.error);  // Bot polling logic
            resolve();
        }),
        new Promise((resolve) => { 
            setInterval(() => scrapper.main(), 600000);  // Run the scraper every 600 seconds
            resolve();
        })
    ]);
})();
