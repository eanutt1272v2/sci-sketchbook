# sci-sketchbook

This repository hosts a collection of scientifically focused sketches, visualisations, applications/applets, and programs implemented in the p5.js and Processing languages, served securely via a Caddy web server with file browsing capabilities. A public instance is available at: <https://sci-sketchbook.onrender.com/>.

## Setup and Deployment

To deploy and run the Caddy server, you will need Docker and Docker Compose installed on your system, with your current user possessing the necessary permissions to operate them.

1.  **Clone the repository**

    ```bash
    git clone https://github.com/eanutt1272v2/sci-sketchbook.git
    cd sci-sketchbook
    ```

2.  **Place your sketch folders**

    The Caddy server is configured to serve files from the `./sketchbook` directory within this project. Your sketch folders (e.g., `Barnsley_Fern`, `Mandelbrot_Set`, etc.) should be placed inside a new directory named `sketchbook` at the root of this repository. For example:

    ```
    sci-sketchbook/
    ├── Caddyfile
    ├── docker-compose.yml
    ├── README.md
    └── sketchbook/
        ├── Barnsley_Fern/
        ├── Burning_Ship_Fractal/
        └── ... (your other sketch folders)
    ```

    You can move your existing sketch folders into this `sketchbook` directory:

    ```bash
    mkdir sketchbook
    mv <your_sketch_folder_1> <your_sketch_folder_2> ... <your_sketch_folder_N> sketchbook/
    ```

3.  **Run the Caddy server**

    Navigate to the root of the `sci-sketchbook` directory in your terminal and run Docker Compose.

    ```bash
    docker compose up -d
    ```

    This command will build the Caddy service, start it in detached mode, and expose it on port 80 (HTTP) and 443 (HTTPS).

4.  **Access the web interface**

    Open your web browser and visit `http://localhost` (or `https://localhost` if you have configured DNS for HTTPS). You should see a file browsing interface displaying your sketch folders.

## Caddy Configuration

The `Caddyfile` is configured to:

-   Serve files from the `/srv` directory inside the container, which is mapped to the `./sketchbook` directory on your host machine.
-   Enable file browsing for easy navigation of your sketch folders.
-   Include security headers for increased protection against a limited range of web attacks:
    -   `X-XSS-Protection: 1; mode=block`
    -   `X-Content-Type-Options: nosniff`
    -   `Referrer-Policy: strict-origin-when-cross-origin`
    -   `Permissions-Policy: geolocation=(), microphone=(), camera=()`

## License

This project is licensed under the terms specified in the `LICENSE` file.
