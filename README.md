# Sci-Sketchbook

This repository now hosts a collection of scientific sketches and visualisations, served securely via a Caddy web server with modern file browsing capabilities.

## Setup and Deployment

To deploy and run the Caddy server, you will need Docker and Docker Compose installed on your system.

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/eanutt1272v2/sci-sketchbook.git
    cd sci-sketchbook
    ```

2.  **Place your sketch folders:**

    The Caddy server is configured to serve files from the `./data` directory within this project. Your sketch folders (e.g., `Barnsley_Fern`, `Mandelbrot_Set`, etc.) should be placed inside a new directory named `data` at the root of this repository. For example:

    ```
    sci-sketchbook/
    ├── Caddyfile
    ├── docker-compose.yml
    ├── README.md
    └── data/
        ├── Barnsley_Fern/
        ├── Burning_Ship_Fractal/
        └── ... (your other sketch folders)
    ```

    You can move your existing sketch folders into this `data` directory:

    ```bash
    mkdir data
    mv Barnsley_Fern Burning_Ship_Fractal Cellular_Division Collatz_Visualization DLA_Growth Diffusion_Limited_Aggregation Eigen Fluvia Fluvia_Lite GLSL_Shader_Exploration_01 Julia_Set Lenia_2D_Studio Lorenz_Attractor Mandelbrot_Set Mandelbulb_GLSL_Shader Mandelbulb_Processing MicroLab Neural_Network PG_Magnetic Sierpinski_Triangle Sketch_4D_3D_Projection Slime_Mold_Growth data/
    ```

3.  **Run the Caddy server:**

    Navigate to the root of the `sci-sketchbook` directory in your terminal and run Docker Compose:

    ```bash
    docker compose up -d
    ```

    This command will build the Caddy service, start it in detached mode, and expose it on port 80 (HTTP) and 443 (HTTPS).

4.  **Access the web interface:**

    Open your web browser and navigate to `http://localhost` (or `https://localhost` if you have configured DNS for HTTPS). You should see a modern file browsing interface displaying your sketch folders.

## Caddy Configuration

The `Caddyfile` is configured to:

-   Serve files from the `/srv` directory inside the container, which is mapped to the `./data` directory on your host machine.
-   Enable file browsing for easy navigation of your sketch folders.
-   Include essential security headers for a more secure browsing experience:
    -   `X-XSS-Protection: 1; mode=block`
    -   `X-Content-Type-Options: nosniff`
    -   `Referrer-Policy: strict-origin-when-cross-origin`
    -   `Permissions-Policy: geolocation=(), microphone=(), camera=()`

## Contributing

Feel free to add more sketches or improve the Caddy configuration. Pull requests are welcome.

## License

This project is licensed under the terms specified in the `LICENSE` file.
