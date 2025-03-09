# Contributing to DSXpert

Thank you for your interest in contributing to DSXpert! We welcome contributions from everyone. Follow these guidelines to get started.

## Prerequisites
Ensure you have the following installed:
- [Visual Studio Code](https://code.visualstudio.com/)
- [Node.js](https://nodejs.org/) (LTS recommended)
- [TypeScript](https://www.typescriptlang.org/) (Optional, but useful for development)

## Development Setup

### Clone the Repository
```sh
git clone https://github.com/patiltrupti6105/DSXpert.git
cd dsxpert
```

### Install Dependencies
```sh
npm install
```

### Running the Extension
1. Open the DSXpert project in VS Code:
   ```sh
   code .
   ```
2. Compile and run the extension in VS Code:
   ```sh
   npm run compile
   ```
3. Press `F5` to launch a new VS Code window with the extension loaded.
4. Open any code file and trigger the optimization command:
   - Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS).
   - Type `DSXpert: Optimize Code` and select it.

## File Structure
```
├── src
│   ├── extension.ts  # Main entry point for the extension
│   ├── webview.ts    # Webview logic
│   ├── utilities.ts  # Helper functions
│   └── ...
├── media
│   ├── styles.css    # Styles for the webview
│   ├── script.js     # JavaScript for webview interaction
│   └── ...
├── package.json      # Extension metadata
├── tsconfig.json     # TypeScript configuration
└── README.md         # Documentation
```

## Building the Project
```sh
npm run build
```

## Debugging
Use `F5` in VS Code to debug the extension while running in a new VS Code window.

## How to Contribute
1. **Fork the Repository** – Click the "Fork" button on GitHub.
2. **Create a New Branch** – Run:
   ```sh
   git checkout -b feature-branch
   ```
3. **Make Changes** – Implement your feature or fix a bug.
4. **Commit Changes** – Run:
   ```sh
   git commit -m 'Add new feature'
   ```
5. **Push to Your Branch** – Run:
   ```sh
   git push origin feature-branch
   ```
6. **Open a Pull Request** – Submit your PR on GitHub for review.

## Issues & Feature Requests
If you find a bug or have an idea for an improvement, please open an [issue on GitHub](https://github.com/patiltrupti6105/DSXpert/issues).

We appreciate your contributions! 🎉
