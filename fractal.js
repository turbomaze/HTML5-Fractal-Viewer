/******************\
|  Fractal Viewer  |
|                  |
| @author Anthony  |
| @version 0.1     |
| @date 2013/09/07 |
| @edit 2013/09/14 |
\******************/

/**********
 * config */
var fractalId = 0;
var fractalParameters = [
						 [-2.5, 1, -1.25, 1.25], //mandelbrot set
						 [-1.25, 2.25, -0.75, 1.75]  //burning ship
						 ];
var maxIterations = 250;
var palette = [[2,7,49], [56,98,198], [110,117,135], [128,102,65], [174, 149, 109]]; //colors to use
var colorMult = 2;
var zoomSpeed = 2.3;
var frameRate = 5;
	
/*************
 * constants */
var widthInputSel = '#canv-width';
var heightInputSel = '#canv-height';
var zoomInputSel = '#zoom';
var numIterInputSel = '#num-iter';
var colorMultInputSel = '#color-mult';

var x_min, x_max, y_min, y_max;
var N_ORIGIN; //canvas origin
var C_ORIGIN = new Vector2(0, 0); //cartesian origin
var xScale; //initial units per pixel
var yScale;
var MS_PER_FRAME = 1000/frameRate;
var width, height; //width and height of canvas
 
/*********************
 * working variables */
var canvas, ctx;
var canvasImageDataObj, canvasPixelArray;
var update;
var mouseIsDown;
var movedAround;
var mouseDownLoc;
var currMouseLocation;

/******************
 * work functions */
function init() {
	////////////////
	//canvas stuff//
	canvas = document.getElementById('canvas');
		canvas.addEventListener('mousedown', function(e) {
			mouseIsDown = true;
			mouseDownLoc = getMousePos(e);
		}, false);
		canvas.addEventListener('mouseup', function(e) {
			mouseIsDown = false;
			isPanning = false;
			
			update = true;
			movedAround = !currMouseLocation.equals(mouseDownLoc); //mouse isn't in the same spot as it was pressed
			if (movedAround) updateCanvas();
		}, false);
		canvas.addEventListener('mousemove', function(e) { //keep track of the mouse
			currMouseLocation = getMousePos(e);
		}, false);
		canvas.addEventListener("mousewheel", function(e) {
			var scrollDelta = Math.max(-1, Math.min(1, e.wheelDelta));
			var priorMouseLocIn2Space = vCanvasToCartesian(currMouseLocation);
			var priorVectorFromMouseToOrigin = C_ORIGIN.sub(priorMouseLocIn2Space);
			if (scrollDelta < 0) {
				xScale *= zoomSpeed;
				yScale *= zoomSpeed;
			} else {
				xScale /= zoomSpeed;
				yScale /= zoomSpeed;
			}
			var postMouseLocIn2Space = vCanvasToCartesian(currMouseLocation);
			var postVectorFromMouseToOrigin = C_ORIGIN.sub(postMouseLocIn2Space);
			var vectorMoveAmount = priorVectorFromMouseToOrigin.sub(postVectorFromMouseToOrigin).cDiv(new Vector2(-xScale, yScale));
			N_ORIGIN = N_ORIGIN.sub(vectorMoveAmount);
			x_min = (0-N_ORIGIN.x)*xScale;
			x_max = (width-N_ORIGIN.x)*xScale;
			y_min = (height-N_ORIGIN.y)*yScale;
			y_max = (0-N_ORIGIN.y)*yScale;
			update = true;
			updateCanvas();
		}, false);
	ctx = canvas.getContext('2d');
	width = canvas.width;
	height = canvas.height;
	canvasImageDataObj = ctx.createImageData(width, height); //create an image data holder
	canvasPixelArray = canvasImageDataObj.data; //enables you to set individual pixels
	clearCanvas();
	
	//////////
	//inputs//
	$(widthInputSel).value = width;
	$(heightInputSel).value = height;
	$(zoomInputSel).value = zoomSpeed;
	$(numIterInputSel).value = maxIterations;
	$(colorMultInputSel).value = colorMult;

	//////////////////
	//misc variables//
	update = true;
	
	///////////////////
	//graph variables//
	loadFractalParameters(fractalId); //sets up all the fractal specific variables
	
	updateCanvas();
}

function updateCanvas() {
	if (!update) return;
	update = false; //don't call it again
	
	/////////////////
	//house keeping//
	var startTime = currentTimeMillis();

	/////////////////////////
	//drag the graph around//
	if (movedAround) {
		N_ORIGIN = N_ORIGIN.add(currMouseLocation.sub(mouseDownLoc));
		x_min = (0-N_ORIGIN.x)*xScale;
		x_max = (width-N_ORIGIN.x)*xScale;
		y_min = (height-N_ORIGIN.y)*yScale;
		y_max = (0-N_ORIGIN.y)*yScale;
		movedAround = false;
	}

	///////////////////////////////////////////////////////////
	//decide which fractal to color the pixels with and do it//
	switch (fractalId) {
		case 0: //mandelbrot
		mandelbrot(0, width, 0, height);
		break;
		
		case 1: //burning ship
		burningShip();
		break;
		
		default: break;
	}
	
	console.log((currentTimeMillis() - startTime)+'ms'); //log how much time it took
}

function reload(which, arg1) {
	switch (which) {
		case 0: //which fractal to draw
		fractalId = arg1;
		loadFractalParameters(fractalId);
		update = true;
		updateCanvas();
		break;
		
		case 1: //canvas width and height
		width = parseInt($(widthInputSel).value); //get width
		height = parseInt($(heightInputSel).value); //get height
		canvasImageDataObj = ctx.createImageData(width, height); //create a new image data holder
		canvasPixelArray = canvasImageDataObj.data; //get the corresponding empty pixel array
		canvas.width = width; //change the width
		canvas.height = height; //and height of the canvas
		N_ORIGIN = new Vector2((-x_min/(x_max - x_min))*width, (y_max/(y_max - y_min))*height); //recalculate the canvas's origin
		xScale = (x_max - x_min)/width; //new x scale
		yScale = (y_max - y_min)/height; //new y scale
		update = true;
		updateCanvas();
		
		case 2: //how much to zoom by each time
		zoomSpeed = parseFloat($(zoomInputSel).value);
		break;
	
		case 3: //maximum number of iterations to test
		maxIterations = parseInt($(numIterInputSel).value);
		update = true;
		updateCanvas();
		break;
		
		case 4: //how many times to repeat the color scheme
		colorMult = parseFloat($(colorMultInputSel).value);
		update = true;
		updateCanvas();
		break;
		
		default: break;
	}
}

function mandelbrot(xs, xe, ys, ye) { //recurses, needs the 
	var currentIdx = 0; //current index in the pixel array (linear representation of 2d image)
	var mathematicalY = canvasYToCartesian(ys); //the mathematical y coordinate of the top left corner
	for (var y = ys; y < ye; y+=1) { //for every row
		var mathematicalX = canvasXToCartesian(xs); //each row starts at the beginning of the x axis
		for (var x = xs; x < xe; x+=1) { //for every pixel in the current row
			var color = getMandelbrotColorFromCoord(mathematicalX, mathematicalY); //get its color
			canvasPixelArray[0+currentIdx] = color[0]; //and color it in
			canvasPixelArray[1+currentIdx] = color[1];
			canvasPixelArray[2+currentIdx] = color[2];
			canvasPixelArray[3+currentIdx] = 255; //full alpha
			
			currentIdx += 4; //you set 4 values in the array, so move over 4
			mathematicalX += xScale; //move along the x axis
		}
		mathematicalY += -yScale; //move down the y axis
	}
	ctx.putImageData(canvasImageDataObj, 0, 0); //all the colors have been computed, so draw 'em
}

function burningShip() {
	var currentIdx = 0; //current index in the pixel array (linear representation of 2d image)
	var mathematicalY = canvasYToCartesian(0); //the mathematical y coordinate of the top left corner
	for (var y = 0; y < height; y+=1) { //for every row
		var mathematicalX = canvasXToCartesian(0); //each row starts at the beginning of the x axis
		for (var x = 0; x < width; x+=1) { //for every pixel in the current row
			var color = getBurningShipColorFromCoord(mathematicalX, mathematicalY); //get its color
			canvasPixelArray[0+currentIdx] = color[0]; //and color it in
			canvasPixelArray[1+currentIdx] = color[1];
			canvasPixelArray[2+currentIdx] = color[2];
			canvasPixelArray[3+currentIdx] = 255; //full alpha
			
			currentIdx += 4; //you set 4 values in the array, so move over 4
			mathematicalX += xScale; //move along the x axis
		}
		mathematicalY += -yScale; //move down the y axis
	}
	ctx.putImageData(canvasImageDataObj, 0, 0); //all the colors have been computed, so draw 'em
}

function getMandelbrotColorFromCoord(x, y) {
	var color = [0, 0, 0];
	
	///////////////////////////////////////////////////
	//check if a point is in one of the main sections//
	var xMinusQuarter = x - 0.25;
	var xPlusOne = x + 1;
	var coordinateYSq = y*y;
	var q = xMinusQuarter*xMinusQuarter + coordinateYSq;
	if (q*(q+xMinusQuarter) < 0.25*coordinateYSq || xPlusOne*xPlusOne + coordinateYSq < 0.0625) {
		return color;
	}

	/////////////////////////////////////////////////////////////////////////
	//if the point isn't that easy, continue with the escape time algorithm//
	var x_ = 0, y_ = 0;
	var iteration = 0;
	var xsq = 0, ysq = 0;
	var val = 0;

	while (val <= 4 && iteration < maxIterations) {
		y_ = x_*y_;
		y_ += y_; //times 2
		y_ += y;
		x_ = (xsq - ysq) + x;					
		
		xsq = x_*x_;
		ysq = y_*y_;
		val = xsq + ysq;
		iteration += 1;
	}

	if (iteration != maxIterations) { //if it didn't survive all the iterations, it has a color
		var mu = iteration - (Math.log(Math.log(val))); //fractional stopping iteration
			mu = palette.length * (mu/maxIterations); //spread the colors out
				if (mu > palette.length) mu = palette.length; //not too big
				else if (mu < 0) mu = 0; //not too small
			mu *= colorMult; //allow the color scheme to repeat
		var intPartMu = Math.floor(mu); //integer part of mu
		var bucket = intPartMu%palette.length; //base the color on the integer part of mu
		var nextBucket = (bucket+1)%palette.length; //the color right after that
		var percentToNextBucket = mu - intPartMu; //the fractional part of mu

		color = getGradient(palette[bucket], palette[nextBucket], 
							1-percentToNextBucket); //invert it because small fractions means more of the first color
	}
	
	return color;
}

function getBurningShipColorFromCoord(x, y) {
	var color = [0, 0, 0];
	
	/////////////////////////////////////////////////////////////////////////
	//if the point isn't that easy, continue with the escape time algorithm//
	var x_ = 0, y_ = 0;
	var iteration = 0;
	var xsq = 0, ysq = 0;

	while (xsq + ysq <= 4 && iteration < maxIterations) {
		y_ = Math.abs(x_*y_);
		y_ += y_; //times 2
		y_ -= y;
		x_ = (xsq - ysq) - x;					
		
		xsq = x_*x_;
		ysq = y_*y_;
		iteration += 1;
	}

	if (iteration != maxIterations) { //if it didn't survive all the iterations, it has a color
		var gray = Math.floor(255 * (1 - (iteration/maxIterations)));
		color[0] = color[1] = color[2] = gray;
	}
	
	return color;
}

function loadFractalParameters(fractal) {
	x_min = fractalParameters[fractal][0];
	x_max = fractalParameters[fractal][1];
	y_min = fractalParameters[fractal][2];
	y_max = fractalParameters[fractal][3];
	N_ORIGIN = new Vector2((-x_min/(x_max - x_min))*width, (y_max/(y_max - y_min))*height);
	xScale = (x_max - x_min)/width;
	yScale = (y_max - y_min)/height;
}

/********************
 * helper functions */
function promptSaveCanvas() {
	var downloadUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
	if (downloadUrl.length < 1024*1024 || confirm('This is a relatively large image, so your browser may crash. Continue?')) {
		window.location = downloadUrl;
	}
}
 
function getSaveFileLink(linkText, fileContents) {
	return '<a href="data:application/octet-stream;base64;charset=utf-8,' + window.btoa(fileContents) + '">' + 
				linkText + 
		   '</a>';
}

function vCanvasToCartesian(c1) { return c1.sub(N_ORIGIN).cMult(new Vector2(xScale, -yScale)); }
function canvasXToCartesian(x) { return xScale*(x - N_ORIGIN.x); }
function canvasYToCartesian(y) { return -yScale*(y - N_ORIGIN.y); }
function vCartesianToCanvas(c1) { return c1.cDiv(new Vector2(xScale, -yScale)).add(N_ORIGIN); }
function cartesianXToCanvas(x) { return N_ORIGIN.x+(x/xScale); }
function cartesianYToCanvas(y) { return N_ORIGIN.y+(y/-yScale); }

function clearCanvas() {
	ctx.fillStyle = '#FFFFFF';
	ctx.fillRect(0, 0, width, height);
}

function getGradient(c1, c2, percent) { //returns an RBG color that's a percentage of the first mixed with the second
	var ret = [0, 0, 0];
	
	ret[0] = Math.floor((percent * c1[0]) + ((1 - percent) * c2[0]))%255;
	ret[1] = Math.floor((percent * c1[1]) + ((1 - percent) * c2[1]))%255;
	ret[2] = Math.floor((percent * c1[2]) + ((1 - percent) * c2[2]))%255;
	
	return ret;		
}

function getRandCSSColor(low, high) { //returns random color in css rgb format, range is [low, high) for r, g, and b
	low = low || 0;
	high = high || 256;
	return 'rgb('+getRandNum(low, high)+','+getRandNum(low, high)+','+getRandNum(low, high)+')';
}

function getMousePos(e) {
	var rect = canvas.getBoundingClientRect();
	return new Vector2(e.clientX-rect.left, e.clientY-rect.top);
}

function $(id) { //for convenience
	if (id.charAt(0) != '#') return false; 
	return document.getElementById(id.substring(1));
}

function currentTimeMillis() {
	return new Date().getTime();
}

function map(n, d1, d2, r1, r2) { //given an n in [d1, d2], return a linearly related number in [r1, r2]
	var Rd = d2-d1;
	var Rr = r2-r1;
	return (Rr/Rd)*(n - d1) + r1;
}

function getRandNum(lower, upper) { //returns number in [lower, upper)
	return Math.floor((Math.random()*(upper-lower))+lower);
}

function assert(value) {
    if (!value) {
        throw "Invalid assertion.";
    }
}

/***********
 * objects */
function Vector2(x, y) {
	this.x = x;
	this.y = y;
	this.magnitude = Math.sqrt(x*x + y*y);		
	this.normalized = function() {
		return new Vector2(this.x/this.magnitude, this.y/this.magnitude);
	}
	this.add = function(b) {
		return new Vector2(this.x+b.x, this.y+b.y);
	}
	this.sAdd = function(x, y) {
		return new Vector2(this.x+x, this.y+y);
	}
	this.sub = function(b) {
		return new Vector2(this.x-b.x, this.y-b.y);
	}
	this.sSub = function(x, y) {
		return new Vector2(this.x-x, this.y-y);
	}
	this.sMult = function(c) { //scalar mult
		return new Vector2(this.x*c, this.y*c);
	}
	this.cMult = function(b) { //element by element mult
		return new Vector2(this.x*b.x, this.y*b.y);
	}
	this.sDiv = function(c) { //scalar div
		return new Vector2(this.x/c, this.y/c);
	}
	this.cDiv = function(b) { //element by element div
		return new Vector2(this.x/b.x, this.y/b.y);
	}
	this.log = function(b) { //log of each element
		return new Vector2(Math.log(this.x), Math.log(this.y));
	}
	this.distance = function(b) {
		return this.sub(b).magnitude;
	}
	this.equals = function(b) {
		return Math.abs(this.x - b.x) < 0.1 && Math.abs(this.y - b.y) < 0.1;
	}
	this.squish = function() {
		return '('+this.x+', '+this.y+')';
	}
}

window.onload = init;