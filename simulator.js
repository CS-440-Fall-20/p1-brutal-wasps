var running = true;
var gl;
var colorBuffer;
var vertexBuffer;
var vertexColor;
var vertexPosition;
var ourAudio;
var points = [];
var colors = [];
var points1 = [];
var vertices = [];
var rotationMatrix = mat4();
var rotationMatrix1 = mat4();
var modelViewMatrix = mat4();
var projectionMatrix = mat4();
var upVector;
var atVector;
var perpendicular;

var newPatch = true;
var verticesAdded = 0;
var pointsAdded = 0;

var x_pos = 0;
var y_pos = 3;
var z_pos = 0;
var diff = 1;
var mov_speed = 0.01;
var at = vec3(x_pos, y_pos, z_pos);
var up = vec3(0, 1, 0);
var eye = vec3(x_pos, y_pos, z_pos - diff);

const WHITE = vec4(1, 1, 1, 1);
const BLUE = vec4(0, 0, 1, 1);
const GREEN = vec4(0, 1, 0, 1);
const BROWN = vec4(210/255, 105/255, 30/255, 1);
// adding ortho params that can be altered
var left = -2.5;
var right = 2.5;
var ytop = 0.5;
var bottom = -3;
var near = -5;
var far = 5;

//patch dimension
var maxPatchX = 15;
var maxPatchZ = 15;

// camera movement speed
var speed = 0.05;

var modelViewMatrixLoc;
var projectionMatrixLoc;
var rotationMatrixLoc;
var fill = 1;

// get key press event listener
document.addEventListener('keydown', getKeyPress);
document.addEventListener("keyup", getKeyUp);
//document.addEventListener("keydown", getKeyPress);

//vertex shader
var vertexShader = `
attribute vec4 vertexPosition;
attribute vec4 vertexColor;
varying vec4 color;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
void main()
{
    vec4 position = projectionMatrix * modelViewMatrix * vertexPosition;
    float divideZ = 1.15 + position.z;
    gl_Position = vec4(position.xy/divideZ, position.z, 1);
    color = vertexColor;
    gl_PointSize = 2.0;
}
`

//fragment shader
var fragShader = `
precision mediump float;
varying vec4 color;
void main()
{
    gl_FragColor = color;
}
`

class Plane {
    constructor(roll, pitch, yaw, maxSpeed) {
        this.roll = roll;
        this.pitch = pitch;
        this.yaw = yaw;

        this.yawRotate = 0.0;
        this.rollRotate = 0.0;
        this.pitchRotate = 0.0;

        this.speed = 0.01;
        this.maxSpeed = maxSpeed;
        this.minSpeed = 0.0;
    }
}

let ourPlane = new Plane(0, 0, 0, 0.1);

//inspired from https://www.w3schools.com/graphics/game_sound.asp
class Sound {
    constructor(src){
        this.sound = document.getElementById("myAudio");
        this.sound.src = src;
        this.playing = true;
    }

    tuneAudio(){
        if (this.playing){
            this.playing = false;
            this.sound.pause();
        }
        else{
            this.sound.play();
            this.playing = true;
        }
    }
}

window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );
    gl = canvas.getContext("webgl");
    if ( !gl )
	{
        alert( "WebGL isn't available" );
    }

    try {
        ourAudio = new Sound("verysad.mp3");
    }
    catch(err){
        console.log("music file not available");
    }

    var program = gl.createProgram();
    var vertShdr = createShaderHelper(vertexShader, true);
    var fragShdr = createShaderHelper(fragShader, false);

    gl.attachShader( program, vertShdr );
    gl.attachShader( program, fragShdr );
    gl.linkProgram( program );
    gl.useProgram( program );

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    makeSmallPatches();
    colors = setColors();
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW );

    var vertexPosition = gl.getAttribLocation( program, "vertexPosition" );

    gl.vertexAttribPointer( vertexPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vertexPosition );
    vertexColor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexColor);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    var vColor = gl.getAttribLocation(program, "vertexColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    //render()
    getRotations();
    animate(0);
}

function mapPoint(P, Q, X, A, B)
{
    var alpha = (((Q-P)*(Q-P) > 0 ) ? (X - P)/(Q - P) : 0);
    var result;

	if (typeof P == "number" && typeof A == "number")
	{
        result = alpha*B + (1 - alpha)*A;
    }

	else
	{
        result = [];
        for (let i = 0; i < A.length; i++)
		{
            result.push(alpha*B[i] + (1 - alpha)*A[i])
        }
    }

    return result
}

function createShaderHelper(sourceString, vertex = true)
{
    var shader = ((vertex) ? gl.createShader( gl.VERTEX_SHADER ) : gl.createShader( gl.FRAGMENT_SHADER ));
    gl.shaderSource( shader, sourceString );
    gl.compileShader( shader );
    return shader;
}

var scl = 0.1;

noise.seed(Math.random()*65000);
function getPatch(xmin, xmax, zmin, zmax)
{
    verticesStart = vertices.length;
    for (let z = zmin; z < zmax; z += scl)
	{
        for (let x = xmin; x < xmax; x += scl)
		{
            //scale = Math.min(Math.min(Math.abs(x - xmax), Math.abs(x - xmin)), Math.min(Math.abs(z - zmax), Math.abs(z - zmin)));
            //scale = Math.min(2, scale)
            var factor = closeToEdge(x, z, xmin, xmax, zmin, zmax, 2)
            let a = vec4(x, noise.perlin2(x, z) * factor, z, 1.0);
            factor = closeToEdge(x + scl, z, xmin, xmax, zmin, zmax, 2)
            let b = vec4(x + scl, noise.perlin2(x + scl, z) * factor, z, 1.0);
            factor = closeToEdge(x, z+scl, xmin, xmax, zmin, zmax, 2)
            let c = vec4(x, noise.perlin2(x, z + scl) * factor, z + scl, 1.0);
            factor = closeToEdge(x + scl, z + scl, xmin, xmax, zmin, zmax, 2)
            let d = vec4(x + scl, noise.perlin2(x + scl, z + scl) * factor, z + scl, 1.0);
            if (a[1] > 1.7) console.log(a);
            vertices.push(a); vertices.push(b); vertices.push(c);
            vertices.push(add(d, vec4(0,0,0,0))); vertices.push(add(b, vec4(0,0,0,0))); vertices.push(add(c, vec4(0,0,0,0)));
        }
    }

    return verticesStart
}

function closeToEdge(x, z, xmin, xmax, zmin, zmax, threshold)
{
    var xDiff = 2;
    var zDiff = 2;
    if (Math.abs(x - xmin) <= threshold || Math.abs(x - xmax) <= threshold)
    {
        xDiff =Math.min(Math.abs(x - xmin),Math.abs(x - xmax))
    }
    if (Math.abs(z - zmin) <= threshold || Math.abs(z - zmax) <= threshold)
    {
        zDiff =  Math.min(Math.abs(z - zmin), Math.abs(z - zmax));
    }
    return Math.min(Math.min(xDiff, zDiff), 2);

}

var atRotatedStored;
var upStored;
var eyeStored;
var contrained = false;
var lastEye;
var lastPitch;
var cPatch = -1;

function translate(axis){

    for (var i = 0; i < axis.length; i++) {
        eye[i] += ourPlane.speed * axis[i];
        at[i] = atRotated[i] + ourPlane.speed * axis[i];
    }

    atRotated = at;
    upRotated = up;
    eyeRotated = eye;
}

function getRotations(){
    upVector = up;
    atVector = subtract(at, eye);
    perpendicular = cross(atVector, upVector);

    //rotate around up vector and get new at and perpendicular vectors
    var yawRotation = rotate(ourPlane.yawRotate, upVector);
    atVector = mult(yawRotation, vec4(atVector, 0.0)).splice(0, 3);
    perpendicular = mult(yawRotation, vec4(perpendicular, 0.0)).splice(0, 3);

    //now rotate around the new perpendicular vector
    //and get new up and at vectors
    var pitchRotation = rotate(ourPlane.pitchRotate, perpendicular);
    atVector = mult(pitchRotation, vec4(atVector, 0.0)).splice(0, 3);
    upVector = mult(pitchRotation, vec4(upVector, 0.0)).splice(0, 3);

    //now rotate around the new at vector
    //and get new up and perpendicular vectors
    var rollRotation = rotate(ourPlane.rollRotate, atVector);
    perpendicular = mult(rollRotation, vec4(perpendicular, 0.0)).splice(0, 3);
    upVector = mult(rollRotation, vec4(upVector, 0.0)).splice(0, 3);

    atRotated = add(atVector, eye);
    up = upVector;
}

function animate(time)
{
    if (running) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        translate(atVector);

        if (contrained)
        {
            atRotated[1] = atRotatedStored
            upRotated[1] = upStored;
            if (eyeRotated[1] > 2.5 || eyeRotated[1] < 3.5)
            {
                contrained = false;
            }
        }

        if (eyeRotated[1] < 2.5 && !contrained)
        {
            lastEye = eyeRotated[1];
            eyeRotated[1] = 2.5;
            atRotatedStored = atRotated[1];
            upStored = upRotated[1];
            contrained = true;
            lastPitch = ourPlane.pitch;
        }

        if (eyeRotated[1] > 3.5 && !contrained)
        {
            lastEye = eyeRotated[1];
            eyeRotated[1] = 3.5;
            atRotatedStored = atRotated[1];
            upStored = upRotated[1];
            contrained = true;
            lastPitch = ourPlane.pitch;
        }


        if (currentPatch(atRotated) != cPatch)
        {
            var oPatch = cPatch;
            cPatch = currentPatch(atRotated);
            if (oPatch != -1)
            {
                changeOfPatch(oPatch, cPatch);
            }
        }

        //eyeRotated[1] = Math.min(3.5, Math.max(2.5, eyeRotated[1]));
        //atRotated[1] = Math.min(3.5, Math.max(2.5, atRotated[1]));


        /*
        right_eye = mult(modelViewMatrix, vec4(left, 0, 0, 1))[0];
        left_eye = mult(modelViewMatrix, vec4(right, 0, 0, 1))[0];
        console.log(eyeRotated);



        if ( eyeRotated[0] > maxPatchX){
            maxPatchX = maxPatchX + 5;
            newPatch = true;
        }
        else if (eyeRotated[0] < maxPatchX - 10){
            maxPatchX = maxPatchX - 5;
            newPatch = true;
        }
        else if ( eyeRotated[2] + far > maxPatchZ ){
            maxPatchZ = Math.ceil(maxPatchZ + 5);
            newPatch = true;
        }

        if (newPatch) {
            getPatch(maxPatchX - 10, maxPatchX, maxPatchZ - 10, maxPatchZ);
            colors = setColors();
        }
        */
        projectionMatrix = ortho(left, right, bottom, ytop, near, far);
        modelViewMatrix = lookAt(eyeRotated, atRotated, upRotated);


        gl.uniformMatrix4fv( modelViewMatrixLoc, false, flatten(modelViewMatrix) );
        gl.uniformMatrix4fv( projectionMatrixLoc, false, flatten(projectionMatrix) );

        //gl.bindBuffer(gl.ARRAY_BUFFER, vertexColor);
        // the variable 'colors' will always have the active shading scheme colors
        //gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);


        if (fill % 4 === 0){ // points
            gl.drawArrays( gl.POINTS, 0, vertices.length );
        }
        else if (fill % 4 === 1){ // wireframe
            gl.drawArrays( gl.LINES, 0, vertices.length );
        }
        else if (fill  % 4 > 0){ // shading involved
            gl.drawArrays( gl.TRIANGLES, 0, vertices.length );
        }
    }
    window.requestAnimationFrame(animate);
}

function shareRow(patch1, patch2)
{
    var a = BOTTOM_ROW.includes(patch1) && BOTTOM_ROW.includes(patch2);
    var b = MIDDLE_ROW.includes(patch1) && MIDDLE_ROW.includes(patch2);
    var c = TOP_ROW.includes(patch1) && TOP_ROW.includes(patch2);
    return a || b || c
}

function changeOfPatch(oPatch, newPatch)
{
    if (shareRow(oPatch, newPatch))
    {
        if (LEFT_COL.includes(newPatch))
        {
            translatePatches(RIGHT_COL, 30, 0);
            oldRight = RIGHT_COL; oldMiddle = MIDDLE_COL; oldLeft = LEFT_COL;
            MIDDLE_COL = oldLeft;
            RIGHT_COL = oldMiddle;
            LEFT_COL = oldRight;
        }
        if (RIGHT_COL.includes(newPatch))
        {
            translatePatches(LEFT_COL, -30, 0);
            oldRight = RIGHT_COL; oldMiddle = MIDDLE_COL; oldLeft = LEFT_COL;
            MIDDLE_COL = oldRight;
            LEFT_COL = oldMiddle;
            RIGHT_COL = oldLeft;
        }
    }
    else
    {
        console.log("ROW CHANGED");
        if (TOP_ROW.includes(newPatch))
        {
            translatePatches(BOTTOM_ROW, 0, 30);
            oldBottom = BOTTOM_ROW; oldTop = TOP_ROW; oldMiddle = MIDDLE_ROW;
            MIDDLE_ROW = oldTop;
            BOTTOM_ROW = oldMiddle;
            TOP_ROW = oldBottom;
        }
        if (BOTTOM_ROW.includes(newPatch))
        {
            translatePatches(TOP_ROW, 0, -30);
            oldBottom = BOTTOM_ROW; oldTop = TOP_ROW; oldMiddle = MIDDLE_ROW;
            MIDDLE_ROW = oldBottom;
            TOP_ROW = oldMiddle;
            BOTTOM_ROW = oldTop;
        }
    }
}

function translatePatches(patchesNum, tx, tz)
{
    for (let i = 0; i < patchesNum.length; i++)
    {
        start = patch_offset[patchesNum[i]];
        end = (patchesNum[i] === 8) ? vertices.length: patch_offset[patchesNum[i] + 1];
        for (let index = start; index < end; index++)
        {
            //console.log(vertices[index]);
            vertices[index][0] += tx;
            vertices[index][2] += tz;
            //console.log(vertices[index]);
        }

        console.log(patch_boundaries[patchesNum[i]]);
        patch_boundaries[patchesNum[i]][0] += tx;
        patch_boundaries[patchesNum[i]][1] += tx;
        patch_boundaries[patchesNum[i]][2] += tz;
        patch_boundaries[patchesNum[i]][3] += tz;
        console.log(patch_boundaries[patchesNum[i]]);

    }
    gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
    gl.bufferSubData( gl.ARRAY_BUFFER, 0, flatten(vertices));

}


var patch_boundaries = [];
var patch_offset = []

var LEFT_COL = [2, 5, 8];
var RIGHT_COL = [0, 3, 6];
var MIDDLE_COL = [1, 4, 7];

var BOTTOM_ROW = [0, 1, 2];
var MIDDLE_ROW = [3, 4, 5];
var TOP_ROW = [6, 7, 8];


function makeSmallPatches()
{
    p1 = [-15, -5, -15, -5];
    patch_boundaries.push(p1);

    p2 = [-5, 5, -15, -5];
    patch_boundaries.push(p2);

    p3 = [5, 15, -15, -5];
    patch_boundaries.push(p3);

    p4 = [-15, -5, -5, 5];
    patch_boundaries.push(p4);

    p5 = [-5, 5, -5, 5];
    patch_boundaries.push(p5);

    p6 = [5, 15, -5, 5];
    patch_boundaries.push(p6);

    p7 = [-15, -5, 5, 15];
    patch_boundaries.push(p7);

    p8 = [-5, 5, 5, 15];
    patch_boundaries.push(p8);

    p9 = [5, 15, 5, 15];
    patch_boundaries.push(p9);

    for (let i = 0; i < patch_boundaries.length; i++)
    {
        var patch = patch_boundaries[i]
        patch_offset.push(getPatch(patch[0], patch[1], patch[2], patch[3]));
    }

}

function currentPatch(currentPos)
{

    x = currentPos[0];
    z = currentPos[2];

    for (let i = 0; i < patch_boundaries.length; i++)
    {
        var patch = patch_boundaries[i];
        x_min = patch[0]; x_max = patch[1];
        z_min = patch[2]; z_max = patch[3];

        if (x < x_max && x > x_min && z < z_max && z > z_min)
        {
            return i;
        }
    }
    return -1;
}

function getVertexColor(vertex)
{
    if (vertex[1] > 1.22)
    {
        color = WHITE;
    }
    else if (vertex[1] > 0.66)
    {
        color = BROWN;
        color = mapPoint(0.66, 1.22, vertex[1], BROWN, WHITE)
    }
    else if (vertex[1] > 0)
    {
        color = GREEN;
        color = mapPoint(0, 0.66, vertex[1], GREEN, BROWN)
    }
    else
    {
        color = vec4(0, 0, 1, 1);
    }
    return color
}

function setColors(){
    if (fill % 4 === 2){ // flat shading
        for (var k = 0; k < vertices.length; k += 3)
        {
            var r = 0; var g = 0; var b = 0;

            for (let i = 0; i < 3; i++)
            {
                color = getVertexColor(vertices[k + i]);
                r += color[0];
                g += color[1];
                b += color[2];
            }

            r = r / 3;
            g = g / 3;
            b = b / 3;

            for (let i = 0; i < 3; i++)
            {
                colors[k + i] = vec4(r, g, b, 1);
            }


        }

    }
    else if (fill % 4 === 3){ // smooth shading

    }
    else if (fill % 4 == 4){ // Phong shading

    }
    else
    {
        for (var k = 0; k < vertices.length; k++)
        {
            colors[k] = vec4(1, 1, 1, 1);
        }
    }
    return colors;
}


function getKeyPress(event){
    if (event.code === 'Numpad4' && left > -5 && right > 0){ // left
        left = left - speed;
        right = right - speed;
    }
    else if (event.code === 'Numpad6' && left < 0 && right < 5){ // right
        left = left + speed;
        right = right + speed;
    }
    else if (event.code === 'Numpad8' && ytop < 1.5 && bottom < -2 ){ // up
        ytop = ytop + speed;
        bottom = bottom + speed;
    }
    else if (event.code === 'Numpad2' && ytop > -1.5 && bottom > -4){ // down
        ytop = ytop - speed;
        bottom = bottom - speed;
    }
    else if (event.code === 'Numpad5' && near > -6 && far > 4 ){ // in
        near = near - speed;
        far = far - speed;
    }
    else if (event.code === 'Numpad0' && near < -4 && far < 6){ // far
        near = near + speed;
        far = far + speed;
    }
    else if (event.code === 'KeyV'){ // toggle view
        fill = fill + 1;
        colors = setColors();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexColor);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(colors));
    }
    else if (event.code === 'KeyW' || event.code === 'KeyS' ||
             event.code === 'KeyE' || event.code === 'KeyA' ||
             event.code === 'KeyD' || event.code === 'KeyQ' ){

        if (event.code === 'KeyW' && (!contrained || eyeRotated[1] === 3.5)
                && ourPlane.pitch < 89.5) {
            ourPlane.pitch += 0.5;
            ourPlane.pitchRotate = 0.5;
            getRotations();
        }
        else if (event.code === 'KeyS' && (!contrained || eyeRotated[1] === 2.5)
                && ourPlane.pitch > -90.5) { //
            ourPlane.pitch -= 0.5;
            ourPlane.pitchRotate = -0.5;
            getRotations();
        }
        else if (event.code === 'KeyA' &&  ourPlane.yaw < 89.5 ) {
            ourPlane.yaw += 0.5;
            console.log(ourPlane.yaw);
            ourPlane.yawRotate = 0.5;
            getRotations();
        }
        else if (event.code === 'KeyD' && ourPlane.yaw > -90.5 ) {
            ourPlane.yaw -= 0.5;
            ourPlane.yawRotate = -0.5;
            getRotations();
        }
        else if (event.code === 'KeyQ' && ourPlane.roll < 89.5 ) {
            ourPlane.roll += 0.5;
            ourPlane.rollRotate = 0.5;
            getRotations();
        }
        else if (event.code === 'KeyE' && ourPlane.roll > -90.5 ) {
            ourPlane.roll -= 0.5;
            ourPlane.rollRotate = -0.5;
            getRotations();
        }
    }

    else if (event.keyCode === 38){ //
        ourPlane.speed = Math.min(ourPlane.speed + 0.01, ourPlane.maxSpeed);
    }
    else if (event.keyCode === 40){ //
        ourPlane.speed = Math.max(ourPlane.speed - 0.01, ourPlane.minSpeed);
    }
    else if (event.keyCode === 27) {
        if (running) running = false;
        else running = true;
        console.log(running);
    }
    else if (event.code === 'KeyP'){
        try {
            ourAudio.tuneAudio();
        }
        catch(err){
            console.log("music file not available");
        }
    }
}

function getKeyUp(event){
    if (event.code === 'KeyW') this.pitchRotate = 0;
    else if (event.code === 'KeyS') this.pitchRotate = 0;
    else if (event.code === 'KeyA') this.yawRotate = 0;
    else if (event.code === 'KeyD') this.yawRotate = 0;
    else if (event.code === 'KeyQ') this.rollRotate = 0;
    else if (event.code === 'KeyE') this.rollRotate = 0;
}
