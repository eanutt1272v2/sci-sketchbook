# p5.js Sketch Library

This repository contains a collection of primarily computational p5.js sketch files and resources, organised into individual project folders.

## Projects

Below is a brief overview of the projects included in the library:

### Fluvia Lite
A stripped-down, minimal version of the main Fluvia project. It includes basic p5.js sketch, HTML, and CSS files.

### Lenia2D Studio (DEV)
The Lenia 2D automaton studio (currently under development). This project includes a generalised cellular automata engine capabale of FFT discretised 'continuous' cellular automata and traditional discrete models. It features a graphical user interface (GUI) powered by the Tweakpane library, some rendering options, and an animal library for different automaton configurations (animals.json).

### Mandelbulb GLSL Shader (Outdated)
3D Mandelbulb fractal rendered using GLSL shaders. This project is marked as outdated, as it has been discontinued.

### Eigen
A fast numerical visualiser of the time-independent Schrödinger equation for a single-electron system. It computes the probability density ∣ψn,l,m​(r,θ,ϕ)∣2 of the Hydrogen atom by evaluating the product of the radial wavefunctions (utilising Generalized Laguerre polynomials) and the angular components (Real Spherical Harmonics derived from Associated Legendre polynomials)

### GLSL Shader Exploration 01
A general project dedicated to exploring the capabilities of GLSL shaders within the p5.js environment. Original shader code by Xor and ported to the p5.js environment

### Fluvia
Fluvia is a fast web-based geomorphological simulation. It utilises a Lagrangian particle-based solver in which water droplets traverse a dual-layer heightmap of bedrock and sediment. As a result of simulating momentum-based transport, deposition, and evaporation physics, it generates realistic fluvial features like drainage basins, meandering rivers, and alluvial fans. Algorithm by Nick McDonald: https://www.nickmcd.me/2023/12/12/meandering-rivers-in-particle-based-hydraulic-erosion-simulations

## Running Sketches

To run any of these p5.js sketches, navigate to the respective project folder and open the `index.html` file in a web browser. Make sure that all related `.js`, `.css`, and shader files are in the same directory or correctly linked together within the `index.html`.
