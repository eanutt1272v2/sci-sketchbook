# p5.js and Processing Sketch Library

This repository is a library of p5.js and Processing sketch files and associated resources. Each sketch is organised into its own dedicated project folder.

## Repository Structure

The repository is structured with individual directories for each p5.js or Processing project. Within each project folder, you will typically find:

*   `index.html` (for p5.js sketches): The entry point for web-based sketches.
*   `sketch.js` (for p5.js sketches): The main JavaScript file containing the p5.js code.
*   `.pde` files (for Processing sketches): The main Processing sketch file or other required source files.
*   `.glsl` files: For sketches utilising GLSL shaders.
*   `.json` files: For sketches that load external data.

## Up and Running

### Sketchbook Web Server (Node.js)

The repository now includes a built-in Express server to easily browse and serve all p5.js sketches.

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Start the Server**:
    ```bash
    npm start
    ```
3.  Open [http://localhost:8080](http://localhost:8080) in your browser. The server provides a custom directory listing with file icons and direct access to all sketch folders.

### p5.js Sketches (Manual)

To execute any of the p5.js sketches without the Node.js server, follow these steps:

1.  Locate the specific project folder for the desired sketch within this repository.
2.  Open the `index.html` file in your preferred web browser.

**Important Notes:**
*   Make sure that all dependent files, including `.js`, `.css`, shader (`.glsl`), and data (`.json`) files, are either located in the same directory as `index.html` or are correctly linked within the `index.html` and `sketch.js` files.
*   For optimal performance and to avoid potential browser security restrictions (e.g., related to loading local files), it is recommended to run p5.js sketches using a local web server (like the built-in Node.js server mentioned above).

### Processing Sketches

To run any of the Processing sketches, you will need the **Processing Development Environment** installed on your computer. The latest version can be downloaded from the [official Processing Website](https://processing.org/download).

Once Processing is installed, proceed as follows:

1.  Go to the respective project folder for the Processing sketch.
2.  Open the primary `.pde` sketch file using the Processing IDE.
3.  Click the "Run" button (a triangular play icon) within the Processing IDE to compile and run the sketch.

**Important Notes:**
*   Verify that any associated data files, libraries, or external assets are correctly placed within the sketch folder or linked as specified by the Processing sketch.
*   If a sketch utilises external libraries, ensure they are installed in your Processing environment (Sketch > Import Library > Add Library...).

## License

This project is distributed under the MIT License. For more information, please refer to the `LICENSE` file in the root of the repository.
