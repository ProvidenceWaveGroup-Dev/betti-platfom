# Betti Smart Mirror Hub: Architecture & Technical Documentation

This document provides a detailed overview of the Betti Smart Mirror Hub's architecture, tech stack, and functionality.

## 1. Project Overview

The Betti Smart Mirror Hub is a full-stack application designed to power a 13.3-inch touchscreen smart mirror. It provides a user interface for displaying personalized information such as appointments, vital signs, and Bluetooth device status. The system consists of a React frontend and a Node.js backend, communicating in real-time via WebSockets and a REST API.

The project is structured as a monorepo using npm workspaces, which allows for managing the `frontend` and `backend` packages within a single repository.

## 2. Tech Stack

The platform is built using modern JavaScript technologies.

### Backend Tech Stack

-   **Runtime:** Node.js
-   **Framework:** Express.js
-   **Real-time Communication:** `ws` (WebSocket) library
-   **Bluetooth LE (BLE):** `@abandonware/noble` - A powerful library for interacting with BLE devices.
-   **Environment Variables:** `dotenv`
-   **Development:** `nodemon` for automatic server restarts.
-   **Core Dependencies:**
    -   `express`: Web server framework.
    -   `cors`: For handling Cross-Origin Resource Sharing.
    -   `ws`: For WebSocket communication.
    -   `@abandonware/noble`: For BLE scanning.
    -   `dotenv`: For managing environment variables.

### Frontend Tech Stack

-   **Library:** React.js (v18)
-   **Build Tool:** Vite
-   **Routing:** `react-router-dom`
-   **Core Dependencies:**
    -   `react` / `react-dom`: For building the user interface.
    -   `react-router-dom`: For client-side routing (though not heavily used in the current single-view setup).

### Root & Tooling

-   **Package Manager:** npm (with workspaces)
-   **Concurrent Task Runner:** `concurrently` - Used to run the frontend and backend development servers simultaneously.

## 3. System Architecture

### 3.1. Monorepo Structure

The project uses an `npm` monorepo structure defined in the root `package.json`. This setup contains two main packages (workspaces):

-   `frontend/`: The React-based user interface.
-   `backend/`: The Node.js server handling business logic and hardware interaction.

This structure simplifies dependency management and allows for coordinated development.

### 3.2. Backend Architecture

The backend is an Express.js server responsible for:
1.  Serving a REST API for specific actions (e.g., initiating a BLE scan).
2.  Managing a WebSocket server for real-time data broadcasting to the frontend.
3.  Interacting with system hardware, specifically the Bluetooth adapter, via the `@abandonware/noble` library.

**Key Components:**

-   **`index.js`**: The main entry point. It initializes the Express server, the WebSocket server (`wss`), and sets up event listeners to bridge the `bleScanner` service with the WebSocket broadcast mechanism.
-   **`routes/ble.js`**: Defines the REST API endpoints related to Bluetooth, such as `POST /api/ble/scan` to start a scan and `GET /api/ble/status` to get the current status.
-   **`services/bleScanner.js`**: The core of the Bluetooth functionality.
    -   It uses `@abandonware/noble` to listen for Bluetooth adapter state changes and discover nearby BLE peripherals.
    -   It is implemented as a singleton `EventEmitter`. Instead of directly handling communication, it emits events like `bleStateChange`, `bleDeviceDiscovered`, and `bleScanStatus`.
    -   This decoupled design avoids circular dependencies and makes the module reusable and easier to test.
-   **WebSocket Communication**: The backend uses the `ws` library to push real-time updates to the frontend. The `broadcast` function in `index.js` sends messages to all connected clients. This is used for:
    -   Broadcasting the Bluetooth adapter's state (`poweredOn`, `poweredOff`, etc.).
    -   Sending details of discovered BLE devices.
    -   Notifying the frontend about the status of a BLE scan (`scanning`, `idle`, `error`).

### 3.3. Frontend Architecture

The frontend is a single-page application built with React and Vite.

**Key Components:**

-   **`main.jsx`**: The entry point for the React application.
-   **`App.jsx`**: The root component that defines the main layout and structure, including the `Header` and the main content grid.
-   **`components/`**:
    -   `Header.jsx`: Displays the time and date.
    -   `Appointments.jsx`: Shows upcoming appointments from a local JSON file.
    -   `Vitals.jsx`: Displays vital signs data from a local JSON file.
    -   `BLEDevices.jsx`: Intended to display the status of BLE devices discovered by the backend.
-   **`services/websocket.js`**: A dedicated module for managing the WebSocket connection to the backend. It handles connection, disconnection, and message reception.
-   **State Management**: The application currently uses component-local state (`useState`, `useEffect`). There is no global state management library like Redux or Zustand. Data from the backend is received via the WebSocket and managed within the relevant components.

## 4. Layout & Sizing

The application is designed for a **13.3-inch touchscreen**. However, the CSS is written to be **fluid and responsive**.

-   The main container (`.app`) is set to `100%` width and `100vh` height, filling the entire viewport of the device.
-   The main content area uses a CSS Grid layout (`.content-grid`) that divides the space into two equal columns.
-   This approach ensures that the application will adapt to the screen dimensions of the smart mirror, rather than being fixed to a specific pixel resolution.

## 5. Building and Running

### Installation

To install all dependencies for the root, frontend, and backend packages:
```bash
npm run install:all
```

### Development

To run both the frontend and backend development servers concurrently:
```bash
npm run dev
```
-   The frontend (Vite) will run on `http://localhost:5173`.
-   The backend (Node/Express) will run on `http://localhost:3001`.
