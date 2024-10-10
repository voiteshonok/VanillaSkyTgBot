import { createClient } from '@supabase/supabase-js'

export class Flight {
    constructor(fromId, toId, dates, hash){
        this.fromId = fromId;
        this.toId = toId;
        this.dates = dates;
        this.hash = hash;
    }
}

export class Database {
    static instance;
    
    constructor() {
        if (Database.instance) {
            return Database.instance;
        }

        const supabaseUrl = 'https://qakiefcpjbqhwoxeahki.supabase.co'
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFha2llZmNwamJxaHdveGVhaGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY1MDcxODQsImV4cCI6MjA0MjA4MzE4NH0.BNkqNOXoK3jyEfG8WX4NcFqZcQ_nb2UNNNEOyHrXrVg'
        this.client = createClient(supabaseUrl, supabaseKey);

        Database.instance = this;
    }
  
    async getFlights(fromId, toId) {

        const {data, error} = await this.client
          .from('flights')
          .select('*')
          .eq('from_destination_id', fromId)
          .eq('to_destination_id', toId);

        console.log(data);

        if (error) {
            console.log(`Error on selecting from ${fromId} to ${toId}`, error);
            return null;
        } else {
            const flights = data.map(
                flight => new Flight(flight.from_destination_id, flight.to_destination_id,
                    flight.dates, flight.hash_of_dates)
            );
            return flights;
        }
    }
}
  