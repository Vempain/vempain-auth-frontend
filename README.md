# Vempain Auth Frontend

Vempain Auth Frontend is a React-based web component for user authentication designed for the Vempain frontends. It
provides a user interface for logging in, registering, and managing authentication states, communicating with a backend
authentication API.

## Features

- User login and registration forms
- Authentication state management
- API integration for authentication
- Error handling and feedback
- Responsive UI built with React

## Getting Started

### Prerequisites

- Node.js (v20 or newer recommended)
- yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/vempain-auth-frontend.git
   cd vempain-auth-frontend
   ```
2. Install dependencies:
   ```bash
   yarn install
   ```

## Project Structure

- `src/` - Main source code
    - `main/` - Main components
    - `models/` - Interfaces and types related to DTOs
        - `models/Requests/` - Interfaces and types related to request DTOs
        - `models/Responses/` - Interfaces and types related to response DTOs
    - `services/` - API service classes
    - `session/` - Session provider

## License

GPL-2 License

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.


