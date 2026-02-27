int currentParticles = 0;
int initialParticles = 500;
bool createInitialParticles = true;
bool useSource = false;

Manager man;
Mouse mouse;
GUI gui;

void setup()
{
   size(screenWidth, screenHeight);
   man = new Manager();
   gui = new GUI(man);
   mouse = new Mouse();
   man.randomTypes();
   man.randomRange();
}

void draw()
{
   man.update();
   gui.update();
   mouse.update();
}