window.addEventListener("resize", function () {
    var pjs = Processing.getInstanceById("sketch");
    if (pjs != null) {
        pjs.resizeSketch();
    }
});

window.addEventListener("wheel", function (e) {
    var pjs = Processing.getInstanceById("sketch");
    if (pjs) {
        e.preventDefault();
        var delta = Math.sign(e.deltaY);
        pjs.externalMouseWheel(delta);
    }
}, { passive: false });