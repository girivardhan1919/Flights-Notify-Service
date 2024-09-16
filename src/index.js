const express = require('express');
const amqplib = require("amqplib");
const { EmailService } = require('./services')
const { ServerConfig } = require('./config');

async function connectQueue() {
    try {
        const connection = await amqplib.connect('amqp://localhost');
        const channel = await connection.createChannel();
        await channel.assertQueue(ServerConfig.NOTIFY_QUEUE);
        channel.consume(ServerConfig.NOTIFY_QUEUE, async (data) => {
           try {
               // Convert the message content to a string
               const message = data.content.toString();
               console.log("Received message:", message);

               // Attempt to parse the message as JSON
               let object;
               try {
                object = JSON.parse(message);
               } catch (parseError) {
                   console.error("Invalid JSON format:", parseError);
                   channel.ack(data); // Acknowledge the invalid message to avoid requeueing
                   return; // Exit the current message processing
               }
               // Send email using the parsed JSON data
               await EmailService.sendEmail(
                   ServerConfig.GMAIL_EMAIL,
                   object.recipientEmail,
                   object.subject,
                   object.text
               );
               // Acknowledge the message after successful processing
               channel.ack(data);
           } catch (error) {
               console.error("Error processing incoming queue message:", error);
               // If there’s a processing error, acknowledge the message so it doesn't get requeued
               channel.ack(data);
           }
        });
    } catch (error) {
        console.error("Error connecting to RabbitMQ or creating a channel:", error);
    }
}

const apiRoutes = require('./routes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.listen(ServerConfig.PORT, async () => {
    console.log(`Successfully started the server on PORT : ${ServerConfig.PORT}`);
    await connectQueue();
    console.log("queue is up and running");
});