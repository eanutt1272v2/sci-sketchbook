# sci-sketchbook <img src="logo.png" alt="logo" align="right" width="175">

This repository hosts a collection of scientifically focused sketches, visualisations, applications, and programs. It includes implementations in **p5.js**, **Processing (Java & JS)**, and **GLSL shaders**, served securely via a Caddy web server.

A public instance is available at: [https://sci-sketchbook.onrender.com/](https://sci-sketchbook.onrender.com/).

## Sketch Collection Index

| Sketch | Description | Tech Stack |
| :--- | :--- | :--- |
| [Barnsley Fern](./sketchbook/Barnsley_Fern) | An iterated function system (IFS) that produces a fractal resembling the Black Spleenwort fern using affine transformations. | Processing (Java & JS versions) |
| [Burning Ship Fractal](./sketchbook/Burning_Ship_Fractal) | A fractal first described by Michael Michelitsch and Otto E. Rössler, known for its resemblance to a ship on fire. | Processing (Java) & p5.js |
| [Cellular Division](./sketchbook/Cellular_Division) | A particle-based simulation of emergent cellular behaviour and division. | Processing (Java & JS versions) |
| [Collatz Visualization](./sketchbook/Collatz_Visualization) | A visual representation of the Collatz conjecture paths (3n + 1 problem) as an organic tree-like structure. | p5.js |
| [Diffusion Limited Aggregation (DLA)](./sketchbook/Diffusion_Limited_Aggregation) | Simulates the process where particles undergoing Brownian motion cluster together to form aggregate structures. | p5.js |
| [Eigen](./sketchbook/Eigen) | A sophisticated visualization tool for exploring linear transformations, eigenvalues, and eigenvectors. | p5.js |
| [Fluvia](./sketchbook/Fluvia) | A high-performance fluid dynamics and terrain erosion simulator. | p5.js & GLSL Shaders |
| [Fluvia Lite](./sketchbook/Fluvia_Lite) | A lightweight version of the Fluvia fluid simulator optimized for web performance. | p5.js |
| [GLSL Shader Exploration 01](./sketchbook/GLSL_Shader_Exploration_01) | A sandbox for experimenting with fragment shaders and procedural generation. | p5.js & GLSL Shaders |
| [Julia Set](./sketchbook/Julia_Set) | Visualisation of the Julia set, a classic fractal associated with the Mandelbrot set. | Processing (Java) |
| [Lenia 2D Studio](./sketchbook/Lenia_2D_Studio) | An advanced implementation of Lenia, a continuous cellular automata system. | p5.js |
| [MandelBulber](./sketchbook/MandelBulber) | A 3D exploration of the Mandelbulb fractal. | Processing (Java) |
| [Mandelbrot Set](./sketchbook/Mandelbrot_Set) | The iconic Mandelbrot set fractal, exploring the boundary of stability for z = z² + c. | Processing (Java) & p5.js |
| [Mandelbulb GLSL Shader](./sketchbook/Mandelbulb_GLSL_Shader) | High-performance 3D Mandelbulb rendering using GPU raymarching. | p5.js & GLSL Shaders |
| [Neural Network](./sketchbook/Neural_Network) | A visualization of a simple feedforward neural network's learning process. | Processing (Java) |
| [Slime Mold Growth](./sketchbook/Slime_Mold_Growth) | A simulation of Physarum polycephalum (slime mold) growth patterns using agent-based modeling. | p5.js |


## Technology Stack

This project uses a variety of creative coding tools and web technologies:

- **p5.js**: A JavaScript library for creative coding, used for most web-based sketches.
- **Processing (Java)**: Original Java-based sketches, requiring the Processing 4.x IDE to run locally.
- **Processing.js**: A legacy JavaScript port of Processing, used for older web-compatible sketches.
- **GLSL Shaders**: High-performance GPU-accelerated graphics used in advanced simulations (e.g., Fluvia, Mandelbulb).
- **Caddy**: A powerful, enterprise-ready open-source web server with automatic HTTPS.
- **Docker & Docker Compose**: Used for containerised deployment and easy setup.

### Environment Requirements
- **Web Sketches**: Requires a modern, WebGL-capable browser (Chrome, Firefox, Safari, Edge).
- **Processing Java Sketches**: Requires [Processing 4.x](https://processing.org/download) installed on your local machine.

## Setup and Deployment

To deploy and run the Caddy server locally, you will need **Docker** and **Docker Compose** installed.

1.  **Clone the repository**
    ```bash
    git clone https://github.com/eanutt1272v2/sci-sketchbook.git
    cd sci-sketchbook
    ```

2.  **Directory Layout**
    The Caddy server serves files from the `./sketchbook` directory.
    ```
    sci-sketchbook/
    ├── Caddyfile
    ├── docker-compose.yml
    ├── README.md
    └── sketchbook/
        ├── Barnsley_Fern/          # Sketch folder
        │   ├── Processing_Java/    # Source (e.g., .pde files)
        │   └── Processing_JS/      # Web version (e.g., index.html)
        ├── Neural_Network/
        │   └── Neural_Network.pde
        └── ...
    ```

3.  **Run the Caddy server**
    ```bash
    docker compose up -d
    ```
    - **Ports**: By default, Caddy uses ports **80** (HTTP) and **443** (HTTPS). If these are in use, modify the `docker-compose.yml` file.
    - **Logs**: Monitor the server logs with `docker compose logs -f caddy`.

4.  **Access the Interface**
    Visit [http://localhost](http://localhost) in your browser to view the sketch directory.

## License
This project is licensed under the terms specified in the `LICENSE` file.
