# Real-Time Collaborative Code & Whiteboard Editor

## Live Demo

https://stream-tune-either-highways.trycloudflare.com

**Note:** This is a temporary Cloudflare Tunnel URL. The application 
is available while the server, Docker containers, and tunnel are running.


## Project Description

A web-based collaborative application that allows multiple users to work together in real time.

Users can write and edit code, draw on a shared whiteboard, communicate through real-time chat, and manage collaborative documents.

## Features

- User Registration and Login
- Forgot Password and Password Reset
- User Profile and Profile Picture
- Real-Time Collaborative Code Editor
- Multiple Programming Language Support
- Real-Time Code Synchronization
- Collaborative Whiteboard
- Drawing Tools
- Real-Time Chat
- Online Users
- Document Management
- User Invitations and Permissions
- Viewer and Editor Access Control
- Version History
- Restore Previous Versions

## Technologies Used

### Frontend
- React.js
- JavaScript
- HTML
- CSS
- Monaco Editor
- Socket.IO Client
- Nginx

### Backend
- Node.js
- Express.js
- Socket.IO
- MongoDB Atlas
- Mongoose
- JWT Authentication
- Nodemailer

### Deployment
- Docker
- Docker Compose
- Docker Engine
- Cloudflare Tunnel

## Project Structure

    realtime-editor/
    |
    |-- client/
    |   |-- src/
    |   |-- public/
    |   |-- Dockerfile
    |   |-- nginx.conf
    |   |-- .dockerignore
    |   |-- package.json
    |
    |-- server/
    |   |-- models/
    |   |-- routes/
    |   |-- Dockerfile
    |   |-- .dockerignore
    |   |-- server.js
    |   |-- package.json
    |
    |-- docker-compose.yml
    |-- README.md

## Requirements

- Node.js and npm (for running without Docker)
- Docker Engine
- Docker Compose
- MongoDB Atlas account

## Environment Variables

Create a `.env` file inside the `server` directory.

Configure the following variables:

    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_gmail_app_password

Use your own configuration values.

Never upload your real passwords, secrets, or `.env` file to GitHub.

## Run with Docker Compose

### 1. Clone the Repository

    git clone https://github.com/RMDewmini/realtime-editor-docker.git

### 2. Open the Project Folder

    cd realtime-editor-docker

### 3. Configure Environment Variables

Create `server/.env` and add the required environment variables.

### 4. Build and Start Containers

    sudo docker compose up -d --build

### 5. Access the Application

Frontend:

    http://localhost:8080

Backend:

    http://localhost:5000

### 6. Check Running Containers

    sudo docker compose ps

### 7. View Application Logs

    sudo docker compose logs -f

### 8. Stop the Application

    sudo docker compose down

## Docker Architecture

- Frontend runs inside an Nginx container.
- Backend runs inside a Node.js container.
- Nginx reverse proxy forwards API requests and Socket.IO connections to the backend.
- MongoDB Atlas is used as the cloud database.
- Docker Compose manages the frontend and backend services.
- Docker volume stores uploaded profile pictures.

## Run Without Docker

### Backend

    cd server
    npm install
    node server.js

Backend runs at:

    http://localhost:5000

### Frontend

Open another terminal:

    cd client
    npm install
    npm run dev

Frontend runs at:

    http://localhost:5173

## How to Use

1. Register a new account.
2. Log in to the application.
3. Create or open a collaborative document.
4. Invite other users to collaborate.
5. Write code together in real time.
6. Use the whiteboard to draw and share ideas.
7. Communicate using real-time chat.
8. View previous versions and restore code when needed.

## Security

- Password-based authentication.
- JWT-based authorization.
- User access permissions.
- Password reset through email.
- Environment variables for sensitive configuration.
- Environment files excluded from Docker build contexts and Git.

## Author

Developed as part of the IT-Simplera Solutions Full Stack Development Internship Project.

**Batch:** 02

**Project:** 01

## License

This project was developed for educational and internship purposes.
