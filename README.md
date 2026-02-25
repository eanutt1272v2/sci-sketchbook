# p5.js and Processing Sketch Library

This repository serves as a curated collection of primarily computational p5.js and Processing sketch files and associated resources. Each sketch is organized into its own dedicated project folder, facilitating easy navigation and execution.

## Repository Structure

The repository is structured with individual directories for each p5.js or Processing project. Within each project folder, you will typically find:

*   `index.html` (for p5.js sketches): The entry point for web-based sketches.
*   `sketch.js` (for p5.js sketches): The main JavaScript file containing the p5.js code.
*   `.pde` files (for Processing sketches): The main Processing sketch file.
*   `assets/` or similar directories: May contain additional resources such as images, fonts, or data files.
*   `shaders/` or `.glsl` files: For sketches utilizing GLSL shaders.
*   `data/` or `.json` files: For sketches that load external data.

## Up and Running

### p5.js Sketches

To execute any of the p5.js sketches, follow these steps:

1.  **Navigate**: Locate the specific project folder for the desired sketch within this repository.
2.  **Open**: Open the `index.html` file in your preferred web browser.

**Important Considerations**:
*   Ensure that all dependent files, including `.js`, `.css`, shader (`.glsl`), and data (`.json`) files, are either located in the same directory as `index.html` or are correctly linked within the `index.html` and `sketch.js` files.
*   For optimal performance and to avoid potential browser security restrictions (e.g., related to loading local files), it is recommended to run p5.js sketches using a local web server. Simple options include Python's `http.server` (`python3 -m http.server`) or Node.js's `serve` package (`npx serve`).

### Processing Sketches

To run any of the Processing sketches, you will need the **Processing Development Environment (PDE)** installed on your computer. The latest version can be downloaded from the [official Processing Website](https://processing.org/) [1].

Once Processing is installed, proceed as follows:

1.  **Navigate**: Go to the respective project folder for the Processing sketch.
2.  **Open**: Open the `.pde` file (the primary sketch file) using the Processing IDE.
3.  **Execute**: Click the "Run" button (a triangular play icon) within the Processing IDE to compile and run the sketch.

**Important Considerations**:
*   Verify that any associated data files, libraries, or external assets are correctly placed within the sketch folder or linked as specified by the Processing sketch.
*   If a sketch utilizes external libraries, ensure they are installed in your Processing environment (Sketch > Import Library > Add Library...).

## Project Highlights

Here are some of the notable projects included in this library:

*   **Eigen**: A p5.js sketch likely exploring computational or mathematical visualizations, potentially involving concepts like eigenvectors or eigenvalues, often used in linear algebra and data analysis.
*   **Fluvia**: A p5.js sketch that leverages GLSL shaders for rendering, suggesting a focus on fluid dynamics, flow simulations, or complex visual effects.
*   **Lenia2D Studio (DEV)**: An interactive p5.js simulation studio dedicated to Lenia, a form of artificial life. This project likely allows for experimentation with various Lenia patterns and parameters, featuring different 
animal types and display modes.
*   **Mandelbulb GLSL Shader (Outdated)**: A p5.js sketch demonstrating a Mandelbulb fractal visualization using GLSL shaders. While marked as outdated, it provides a valuable example of complex 3D fractal rendering.
*   **GLSL Shader Exploration 01**: A p5.js project focused on experimenting with GLSL shaders, offering insights into custom visual effects and graphics programming.
*   **Fluvia Lite**: A simplified version of the Fluvia sketch, likely optimized for performance or demonstrating core concepts without the full complexity of the main Fluvia project.

## License

This project is distributed under the MIT License. For more information, please refer to the `LICENSE` file in the root of the repository.

## Contributing

Contributions are welcome! If you have a p5.js or Processing sketch you'd like to add, please consider submitting a pull request. Before contributing, please ensure your code adheres to the following guidelines:

*   Organize your sketch within its own clearly named folder.
*   Provide a brief `README.md` within your sketch folder describing its purpose and how to run it.
*   Ensure all dependencies are either included or clearly documented.
*   Follow consistent coding styles (e.g., 2-space indentation for p5.js files).

## References

[1] Processing Foundation. *Processing.org*. [https://processing.org/](https://processing.org/)
