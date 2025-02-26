# DSXpert

DSXpert is a VS Code extension that helps optimize code by automatically suggesting better data structures and improving algorithm efficiency. The extension integrates AI to analyze the code and provides an optimized version along with an explanation.

## Features
- Automatically optimizes code by suggesting better data structures.
- Provides explanations for the optimizations made.
- Allows users to accept or reject optimizations.
- Elegant UI with tab-based navigation for original and optimized code.
<br/>
  
  ![image](https://github.com/user-attachments/assets/95525226-38d7-4280-949c-94afb109577c)


## Installation
### Prerequisites
Ensure you have the following installed:
- [Visual Studio Code](https://code.visualstudio.com/)
- [Node.js](https://nodejs.org/) (LTS recommended)
- [TypeScript](https://www.typescriptlang.org/) (Optional, but useful for development)

### Clone the Repository
```sh
git clone https://github.com/yourusername/dsxpert.git
cd dsxpert
```

### Install Dependencies
```sh
npm install
```

## Running the Extension
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

## How to Use
1. Open a file with code that you want to optimize.
2. Run the `DSXpert: Optimize Code` command from the Command Palette.
   <br/>
   ![image](https://github.com/user-attachments/assets/605d8767-468f-43f7-bc29-24e6462aadfc)

4. A webview will appear displaying:
   - **Original Code**
   - **Optimized Code** (if any changes were made)
   - **Explanation** of the changes
     <br/>
     ![image](https://github.com/user-attachments/assets/f3b2a66b-34d8-43f5-b02f-47ae087c9ece)

5. Click `Accept` to apply the optimized code, or `Reject` to discard changes.
   <br/>
![image](https://github.com/user-attachments/assets/544d6f2c-a54f-46a3-8446-acedcca1a0bb)

## Development
### File Structure
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
└── README.md         # This file
```

### Building the Project
```sh
npm run build
```

### Debugging
Use `F5` in VS Code to debug the extension while running in a new VS Code window.

## Contributing
Pull requests and feature requests are welcome! If you'd like to contribute:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Commit your changes (`git commit -m 'Add new feature'`).
4. Push to your branch (`git push origin feature-branch`).
5. Open a Pull Request.

## License
This project is licensed under the MIT License. See the `LICENSE` file for more details.

## Contact
For any issues or feature requests, feel free to open an issue on GitHub or contact the developer at `patiltrupti6105@gmail.com`.

