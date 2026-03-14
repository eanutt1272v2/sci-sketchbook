
// @file Neural_Network.pde
// @author @eanutt1272.v2
// @version 1.0.0
// --- GLOBAL VARIABLES & UI PARAMETERS ---
NeuralNetwork nn;  //neural network
// grid parameters
int gridSize = 28;
int gridRows = gridSize;
int gridCols = gridSize;
float[][] gridData = new float[gridRows][gridCols];
int cellSize = 12.5;      // size of each grid cell in pixels
int gridX = 20;         // top-left x position of the grid
int gridY = 40;         // top-left y position of the grid

int firstLabelButtonRowY = 115;
int secondLabelButtonRowY = firstLabelButtonRowY + 50 + 5;

boolean justPressed;
int frameIndex;
boolean trainedYet = false;

float lRate = 0.25;

// Training data storage
ArrayList<float[]> trainingInputs = new ArrayList<float[]>();
ArrayList<float[]> trainingTargets = new ArrayList<float[]>();
int maxTrainingSamples = 1000;

Button predictButton;
Button clearButton;
Button trainButton;

Button zeroButton;
Button oneButton;
Button twoButton;
Button threeButton;
Button fourButton;

Button fiveButton;
Button sixButton;
Button sevenButton;
Button eightButton;
Button nineButton;

void setup() {
   size(screenWidth, screenHeight, P2D);
   
   nn = new NeuralNetwork(new int[]{gridSize*gridSize, 50, 25, 10});
   
   predictButton = new Button(20, gridX + cellSize * gridRows + 30, 100, 50, "Predict");
   trainButton = new Button(125, gridX + cellSize * gridRows + 30, 100, 50, "Train");
   clearButton = new Button(230, gridX + cellSize * gridRows + 30, 100, 50, "Clear");
   
   zeroButton = new Button((1 - 1) * 50 + (1 - 1) * 5 + 20, gridX + cellSize * gridRows + firstLabelButtonRowY, 50, 50, "0");
   oneButton = new Button((2 - 1) * 50 + (2 - 1) * 5 + 20, gridX + cellSize * gridRows + firstLabelButtonRowY, 50, 50, "1");
   twoButton = new Button((3 - 1) * 50 + (3 - 1) * 5 + 20, gridX + cellSize * gridRows + firstLabelButtonRowY, 50, 50, "2");
   threeButton = new Button((4 - 1) * 50 + (4 - 1) * 5 + 20, gridX + cellSize * gridRows + firstLabelButtonRowY, 50, 50, "3");
   fourButton = new Button((5 - 1) * 50 + (5 - 1) * 5 + 20, gridX + cellSize * gridRows + firstLabelButtonRowY, 50, 50, "4");
   
   fiveButton = new Button((1 - 1) * 50 + (1 - 1) * 5 + 20, gridX + cellSize * gridRows + secondLabelButtonRowY, 50, 50, "5");
   sixButton = new Button((2 - 1) * 50 + (2 - 1) * 5 + 20, gridX + cellSize * gridRows + secondLabelButtonRowY, 50, 50, "6");
   sevenButton = new Button((3 - 1) * 50 + (3 - 1) * 5 + 20, gridX + cellSize * gridRows + secondLabelButtonRowY, 50, 50, "7");
   eightButton = new Button((4 - 1) * 50 + (4 - 1) * 5 + 20, gridX + cellSize * gridRows + secondLabelButtonRowY, 50, 50, "8");
   nineButton = new Button((5 - 1) * 50 + (5 - 1) * 5 + 20, gridX + cellSize * gridRows + secondLabelButtonRowY, 50, 50, "9");
   
   clearGrid();
   textSize(14);
}

void draw() {
   try {
      if (mousePressed && mouseButton == LEFT) {
         if (frameIndex++ % 2 == 0) mouseDown();
      } else {
         frameIndex = 0;
         justPressed = false;
      }
      frameRate(120);
      background(0);
      
      drawGrid();
      
      textAlign(LEFT);
      
      textSize(20);
      fill(255);
      text("Input Grid", gridX, gridY - 10);
      text("Label", 20, gridY + cellSize * gridRows + 85);
      
      drawNetwork();
      
      fill(255);
      textAlign(LEFT);
      text("Draw a digit on the grid with your mouse/finger.", 20, gridY + cellSize * gridRows + 220);
      text("Press a number key (0-9) to add the digit with the label to the dataset.", 20, gridY + cellSize * gridRows + 240);
      text("Press 'P' or 'Predict' to predict, and 'C' or 'Clear' to clear the grid", 20, gridY + cellSize * gridRows + 260);
      text("and 'T' or 'Train' to train the neural network on the whole dataset.", 20, gridY + cellSize * gridRows + 280);
      
      text("Training samples: " + trainingInputs.size(), 20, gridY + cellSize * gridRows + 300);
      text("Trained yet: " + trainedYet, 20, gridY + cellSize * gridRows + 320);
      
      for (Button b : new Button[]{predictButton, clearButton, trainButton, zeroButton, oneButton, twoButton, threeButton, fourButton, fiveButton, sixButton, sevenButton, eightButton, nineButton}) {
         b.display();
      }
   } catch (Exception e) {
      println(e);
   }
}

void mouseDragged() {
   try {
      drawOnGrid();
   } catch (Exception e) {
      println(e);
   }
}

void mouseDown() {
   if (predictButton.isMouseOver() && !justPressed) {
      justPressed = true;
      try {
         float[] inputs = gridToInputVector();
         float[] output = nn.feedForward(inputs);
         int predicted = argMax(output);
         println("Predicted digit: " + predicted);
      } catch (Exception e) {
         println(e);
      }
   }
   
   if (clearButton.isMouseOver() && !justPressed) {
      justPressed = true;
      try {
         clearGrid();
      } catch (Exception e) {
         println(e);
      }
   }
   
   if (trainButton.isMouseOver() && !justPressed) {
      println("Started Training");
      justPressed = true;
      trainOnAllSamples();
   }
   
   // Digit button handlers
   if (zeroButton.isMouseOver() && !justPressed) selectLabel(0);
   if (oneButton.isMouseOver() && !justPressed) selectLabel(1);
   if (twoButton.isMouseOver() && !justPressed) selectLabel(2);
   if (threeButton.isMouseOver() && !justPressed) selectLabel(3);
   if (fourButton.isMouseOver() && !justPressed) selectLabel(4);
   if (fiveButton.isMouseOver() && !justPressed) selectLabel(5);
   if (sixButton.isMouseOver() && !justPressed) selectLabel(6);
   if (sevenButton.isMouseOver() && !justPressed) selectLabel(7);
   if (eightButton.isMouseOver() && !justPressed) selectLabel(8);
   if (nineButton.isMouseOver() && !justPressed) selectLabel(9);
   
   drawOnGrid();
}

void drawOnGrid() {
   if (mouseX >= gridX && mouseX < gridX + gridCols * cellSize && mouseY >= gridY && mouseY < gridY + gridRows * cellSize) {
      int x = (int) (mouseX / cellSize) - 2;
      int y = (int) (mouseY / cellSize) - 3;
      if (x >= 0 && x < gridCols && y >= 0 && y < gridRows * cellSize) {
         gridData[constrain(y, 0, gridRows - 1)][constrain(x, 0, gridCols - 1)] = 1;
      }
   }
}

void selectLabel(int label) {
   float[] inputs = gridToInputVector();
   
   float[] target = new float[10];
   for (int i = 0; i < 10; i++){
      target[i] = 0;
   }
   target[label] = 1;
   
   if (trainingInputs.size() >= maxTrainingSamples) {
      trainingInputs.remove(0);
      trainingTargets.remove(0);
   }
   trainingInputs.add(inputs);
   trainingTargets.add(target);
   
   println("Added training sample for: " + label + " (Total: " + (trainingInputs.size()) + ")");
}

void trainOnAllSamples() {
   if (trainingInputs.isEmpty()) {
      println("No training data available!");
      return;
   }
   
   println("Training on " + trainingInputs.size() + " samples...");
   int epochs = 100;
   for (int epoch = 0; epoch < epochs; epoch++) {
      for (int i = 0; i < trainingInputs.size(); i++) {
         nn.train(trainingInputs.get(i), trainingTargets.get(i));
      }
      println("Epoch " + (epoch+1) + "/" + epochs + " completed");
   }
   println("Training complete! Total samples: " + trainingInputs.size());
   
   // Test with current grid
   float[] inputs = gridToInputVector();
   float[] output = nn.feedForward(inputs);
   int predicted = argMax(output);
   println("Test prediction after training: " + predicted);
   trainedYet = true;
}

void keyPressed() {
   if (key == 'c' || key == 'C') {
      clearGrid();
   } 
   
   else if (key >= '0' && key <= '9') {
      selectLabel(key - '0');  // Convert char to actual integer
   } 
   
   else if (key == 'p' || key == 'P') {
      float[] inputs = gridToInputVector();
      float[] output = nn.feedForward(inputs);
      int predicted = argMax(output);
      println("Predicted digit: " + predicted);
   }
   
   else if (key == 't' || key == 'T') {
      trainOnAllSamples();
   }
}

float[] gridToInputVector() {
   float[] input = new float[gridRows * gridCols];
   int index = 0;
   for (int i = 0; i < gridRows; i++){
      for (int j = 0; j < gridCols; j++){
         input[index++] = gridData[i][j];
      }
   }
   return input;
}

int argMax(float[] output) {
   int index = 0;
   float maxVal = output[0];
   for (int i = 1; i < output.length; i++){
      if (output[i] > maxVal){
         maxVal = output[i];
         index = i;
      }
   }
   return index;
}

void clearGrid() {
   for (int i = 0; i < gridRows; i++){
      for (int j = 0; j < gridCols; j++){
         gridData[i][j] = 0;
      }
   }
}

void drawGrid() {
   fill(0);
   stroke(255);
   strokeWeight(1);
   rect(gridX, gridY, gridCols * cellSize, gridRows * cellSize);
   
   for (int i = 0; i < gridRows; i++){
      for (int j = 0; j < gridCols; j++){
         if (gridData[i][j] > 0) {
            fill(gridData[i][j] * 255);
         } else {
            fill(0);
         }
         stroke(100);
         rect(gridX + j * cellSize, gridY + i * cellSize, cellSize, cellSize);
      }
   }
}

void drawNetwork() {
   textAlign(LEFT);
   int layersCount = nn.layers.length;
   
   float netXStart = 600;
   float netXEnd = width - 80;
   float xSpacing = (netXEnd - netXStart) / (layersCount - 1);
   
   PVector[][] neuronPositions = new PVector[layersCount][];
   for (int l = 0; l < layersCount; l++){
      int nCount = nn.layers[l];
      neuronPositions[l] = new PVector[nCount];
      float layerYSpacing = (height - 100) / (nCount + 1);
      float x = netXStart + l * xSpacing;
      for (int i = 0; i < nCount; i++){
         float y = 50 + (i + 1) * layerYSpacing;
         neuronPositions[l][i] = new PVector(x, y);
      }
   }
   
   for (int l = 0; l < layersCount - 1; l++){
      for (int i = 0; i < nn.layers[l]; i++){
         PVector start = neuronPositions[l][i];
         for (int j = 0; j < nn.layers[l + 1]; j++){
            PVector end = neuronPositions[l + 1][j];
            float weight = nn.weights[l][j][i];
            float alpha = map(abs(weight), 0, 1, 0, 255);
            if (weight > 0) {
               stroke(255, 0, 0, alpha);
            } else {
               stroke(0, 0, 255, alpha);
            }
            strokeWeight(1);
            line(start.x, start.y, end.x, end.y);
         }
      }
   }
   
   for (int l = 0; l < layersCount; l++){
      for (int i = 0; i < nn.layers[l]; i++){
         PVector pos = neuronPositions[l][i];
         float activation = nn.neurons[l][i];
         float col = map(activation, 0, 1, 0, 255);
         fill(col);
         strokeWeight(0.5);
         stroke(255);
         ellipse(pos.x, pos.y, 7.5, 7.5);
      }
   }
   
   // Draw output labels
   int outputLayer = layersCount - 1;
   textSize(16);
   for (int i = 0; i < nn.layers[outputLayer]; i++){
      PVector pos = neuronPositions[outputLayer][i];
      float activation = nn.neurons[outputLayer][i];
      fill(255);
      textAlign(LEFT, CENTER);
      text(i + ": " + 100 * round(activation * 1000) / 1000 + "%", pos.x + 10, pos.y + 5);
   }
   
   // Draw layer labels
   textSize(18);
   fill(255);
   textAlign(CENTER);
   text("Input", netXStart, 40);
   text("Hidden 1", netXStart + xSpacing, 40);
   if (layersCount > 3) text("Hidden 2", netXStart + 2*xSpacing, 40);
   text("Output", netXEnd, 40);
}

// --- FIXED NEURAL NETWORK CLASS ---
class NeuralNetwork {
   int[] layers;         // e.g., [256, 64, 32, 10]
   float[][] neurons;    // activation values
   float[][] biases;     // biases for each neuron (except inputs)
   float[][][] weights;  // weights between layers
   float learningRate = lRate;
   float[][] errors;     // Store errors for backpropagation
   
   NeuralNetwork(int[] layers) {
      this.layers = layers;
      errors = new float[layers.length][];
      
      // Create arrays for neurons.
      neurons = new float[layers.length][];
      for (int i = 0; i < layers.length; i++) {
         neurons[i] = new float[layers[i]];
         errors[i] = new float[layers[i]];
      }
      
      // Create arrays for biases.
      biases = new float[layers.length - 1][];
      for (int i = 0; i < layers.length - 1; i++) {
         biases[i] = new float[layers[i + 1]];
      }
      
      // Create arrays for weights.
      weights = new float[layers.length - 1][][];
      for (int l = 0; l < layers.length - 1; l++) {
         int inCount = layers[l];
         int outCount = layers[l + 1];
         float limit = 0.5;
         weights[l] = new float[outCount][inCount];
         for (int j = 0; j < outCount; j++) {
            for (int i = 0; i < inCount; i++) {
               weights[l][j][i] = random(-limit, limit);
            }
            biases[l][j] = random(-limit, limit);
         }
      }
   }
   
   // Feed-forward propagation.
   float[] feedForward(float[] input) {
      // Set input layer
      for (int i = 0; i < layers[0]; i++) {
         neurons[0][i] = input[i];
      }
      
      // Propagate through layers
      for (int l = 1; l < layers.length; l++) {
         for (int j = 0; j < layers[l]; j++) {
            float sum = biases[l - 1][j];
            for (int i = 0; i < layers[l - 1]; i++) {
               sum += weights[l - 1][j][i] * neurons[l - 1][i];
            }
            neurons[l][j] = sigmoid(sum);
         }
      }
      return neurons[layers.length - 1];
   }
   
   // Fixed backpropagation training.
   void train(float[] input, float[] target) {
      feedForward(input);
      int L = layers.length - 1;  // Last layer index
      
      // Calculate output layer error
      for (int i = 0; i < layers[L]; i++) {
         float output = neurons[L][i];
         errors[L][i] = (target[i] - output) * output * (1 - output);
      }
      
      // Backpropagate errors to hidden layers
      for (int l = L - 1; l >= 1; l--) {
         for (int i = 0; i < layers[l]; i++) {
            float errorSum = 0.0;
            for (int j = 0; j < layers[l + 1]; j++) {
               errorSum += weights[l][j][i] * errors[l + 1][j];
            }
            errors[l][i] = errorSum * neurons[l][i] * (1 - neurons[l][i]);
         }
      }
      
      // Update weights and biases
      for (int l = 0; l < layers.length - 1; l++) {
         for (int j = 0; j < layers[l + 1]; j++) {
            for (int i = 0; i < layers[l]; i++) {
               weights[l][j][i] += learningRate * errors[l + 1][j] * neurons[l][i];
            }
            biases[l][j] += learningRate * errors[l + 1][j];
         }
      }
   }
   
   // Sigmoid activation function.
   float sigmoid(float x) {
      return 1.0 / (1.0 + exp(-x));
   }
   
   // Derivative of sigmoid function
   float sigmoidDerivative(float x) {
      float s = sigmoid(x);
      return s * (1 - s);
   }
}

class Button {
   float x, y, w, h;
   String label;
   
   Button(float x, float y, float w, float h, String label) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.label = label;
   }
   
   void display() {
      noStroke();
      if (isMouseOver()) {
         fill(100);
      } else {
         fill(50);
      }
      rect(x, y, w, h, 10);
      fill(255);
      textSize(18);
      textAlign(CENTER, CENTER);
      text(label, x + w/2, y + h/2 + 18 / 2.5 - 1);
   }
   
   boolean isMouseOver() {
      return (mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h);
   }
}