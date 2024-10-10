-- migrations/20240921_create_flights.sql

CREATE TABLE flights (
    from_destination_id INT NOT NULL,                                
    to_destination_id INT NOT NULL,                                  
    dates TEXT[] NOT NULL, -- Array of strings                       
    hash_of_dates TEXT NOT NULL,                                      
    PRIMARY KEY (from_destination_id, to_destination_id)
);
