-- migrations/<timestamp>_create_destination_table.sql

-- Create the 'destination' table
CREATE TABLE IF NOT EXISTS public.destination (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);