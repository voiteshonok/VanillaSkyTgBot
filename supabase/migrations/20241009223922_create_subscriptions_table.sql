
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  from_destination_id INT NOT NULL,
  to_destination_id INT NOT NULL,
  chat_id INT NOT NULL
);