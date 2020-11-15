var simulatorRunning = true;
var gl;
var colorBuffer;
var vertexBuffer;
var vertexColor;
var vertexPosition;
var ourAudio;
var accAudio;
var points = [];
var colors = [];
var vertices = [];
var vNormals = [];
var verticesFaces = {};
var vertShdr;
var fragShdr;
var normalBuffer;
var ambBuffer;
var program;

//vertices and points added when generated patch
var verticesAdded = 0;
var pointsAdded = 0;

//transformation matrices
var rotationMatrix = mat4();
var modelViewMatrix = mat4();
var projectionMatrix = mat4();
var normalMatrix;
var theta = 0;
var phi = 0;
var radius = 0.0;
var faces = {}
var faceNum = 0;
var phongBool = false;

//vectors defining the camera axes
var upVector;
var atVector;
var perpendicular;

//defining initial position of camera
var xPos = 0;
var yPos = 3;
var zPos = 0;
var diff = 1;
var at = vec3(xPos, yPos, zPos);
var up = vec3(0, 1, 0);
var eye = vec3(xPos, yPos, zPos - diff);

const WHITE = vec4(1, 1, 1, 1);
const BLUE = vec4(0, 0, 1, 1);
const GREEN = vec4(0, 1, 0, 1);
const BROWN = vec4(210/255, 105/255, 30/255, 1);

// ortho params that can be altered
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
var speed = 0.03;

// unifrom's location webgl program
var modelViewMatrixLoc;
var projectionMatrixLoc;

var fill = 0;
var viewMode = 0;


var lightPosition = vec4(1.0, 1.0, 1.0, 0.0 );
var lightAmbient = vec4(0.8, 0.8, 0.8, 1.0 );
var lightDiffuse = vec4( 1, 1, 1, 1.0 );
var lightSpecular = vec4( 0.5, 0.5, 0.5, 1.0 );

var materialAmbient = vec4( 1.0, 1.0, 1.0, 1.0 );
var materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var materialSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

var materialShininess = 100.0;
var ka = 1.0;
var kd = 1.0;
var ks = 1.0;


// get key up and down event listener
document.addEventListener('keydown', getKeyPress);
document.addEventListener("keyup", getKeyUp);

var vertexShader = `
attribute vec4 vertexPosition;
attribute vec4 vertexColor;
attribute vec3 vNormal;
varying vec4 color;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

uniform vec4 ambientProduct, diffuseProduct, specularProduct;
uniform vec4 lightPosition;
uniform float shininess;
void main()
{
    //code copy pasted from Anisa's recitation

    vec3 pos = -(modelViewMatrix * vertexPosition).xyz;
    
    //fixed light postion
    
    vec3 light = lightPosition.xyz;
    vec3 L = normalize( light - pos );
	
    vec3 E = normalize( -pos );
    vec3 H = normalize( L + E );
    
    vec4 NN = vec4(vNormal,0);

    // Transform vertex normal into eye coordinates
       
    vec3 N = normalize( (modelViewMatrix*NN).xyz);

    // Compute terms in the illumination equation
    vec4 ambient = ambientProduct;

    float Kd = max( dot(L, N), 0.0 );
    vec4  diffuse = Kd*diffuseProduct;

    float Ks = pow( max(dot(N, H), 0.0), shininess );
    vec4  specular = Ks * specularProduct;
    
    if( dot(L, N) < 0.0 ) {
	specular = vec4(0.0, 0.0, 0.0, 1.0);
    } 

    vec4 position = projectionMatrix * modelViewMatrix * vertexPosition;
    float divideZ = 1.05 + position.z;
    gl_Position = vec4(position.xy/divideZ, position.z, 1);

    color = ambient + diffuse + specular;
    color.a = 1.0;
    color = color * vertexColor;
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

var vertexShaderPhong = `
attribute vec4 vertexPosition;
attribute vec4 vertexColor;
attribute vec3 vNormal;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
varying vec3 normalInterp;
varying vec3 pos;
varying vec4 color;
void main()
{
    vec4 position = projectionMatrix * modelViewMatrix * vertexPosition;
    float divideZ = 1.05 + position.z;
    gl_Position = vec4(position.xy/divideZ, position.z, 1);
    vec4 NN = vec4(vNormal,0);
    // Transform vertex normal into eye coordinates
       
    //normalInterp = (modelViewMatrix*NN).xyz;    // assign to 'varying' variable to allow interpolation
    normalInterp = vec3(NN.xyz);
    pos = -(modelViewMatrix * vertexPosition).xyz;
    color = vertexColor;
}
`
//fragment shader for Phong
var fragShaderPhong = `
precision mediump float;
varying vec3 normalInterp;
uniform vec4 ambientProduct, diffuseProduct, specularProduct;
uniform vec4 lightPosition;
uniform float shininess;
uniform float Ka;
uniform float Kd;
uniform float Ks;
varying vec3 pos;
varying vec4 color;
void main()
{
    vec3 N = normalize(normalInterp);
    vec3 light = lightPosition.xyz;
    vec3 L = normalize( light - pos );  // light source
    // from http://www.cs.toronto.edu/~jacobson/phong-demo/
    // Lambert's cosine law
    float lambertian = max(dot(N, L), 0.0);
    float specular = 0.0;
    if(lambertian > 0.0) {
        vec3 R = reflect(-L, N);      // Reflected light vector
        vec3 V = normalize(-pos); // Vector to viewer
        // Compute the specular term
        float specAngle = max(dot(R, V), 0.0);
        specular = pow(specAngle, shininess);
      }
    gl_FragColor = color * vec4(Ka * ambientProduct.xyz +
                        Kd * lambertian * diffuseProduct.xyz +
                        Ks * specular * specularProduct.xyz, 1.0);
}
`

/* Plane class
roll, pitch, yaw are current orientations of plane
whereas maximum speed is the max speed the plane can fly at
*/
class Plane {
    constructor(roll, pitch, yaw, maxSpeed) {
        this.roll = roll;
        this.pitch = pitch;
        this.yaw = yaw;

        /*
        in each iteration these are either 0.5, 0.0 or -0.5
        depending on which direction the user wants to rotate (0.5 or -0.5)
        or not at all (0). 0.5 signifies the angle of rotation corresponding
        to one single rotation.
        */
        this.yawRotate = 0.0;
        this.rollRotate = 0.0;
        this.pitchRotate = 0.0;

        this.speed = 0.01;
        this.maxSpeed = maxSpeed;
        this.minSpeed = 0.0;
    }
}

//all angles are zero and max speed is 0.1
let ourPlane = new Plane(0, 0, 0, 0.1);

/*
inspired from https://www.w3schools.com/graphics/game_sound.asp
handles the audio. Playing/pausing audio is mapped to key P on the keyboard
*/
class Sound {
    constructor(src, element) {
        this.sound = document.getElementById(element);
        this.sound.src = src;
        this.playing = true;
    }

    //If already playing, pause otherwise play
    tuneAudio() {
        if (this.playing) {
            this.playing = false;
            this.sound.pause();
        }
        else {
            this.sound.play();
            this.playing = true;
        }
    }
}

window.onload = function init() {
    var canvas = document.getElementById( "gl-canvas" );
    gl = canvas.getContext("webgl");
    if ( !gl ) {
        alert( "WebGL isn't available" );
    }

    //add sound
    try {
        ourAudio = new Sound("verysad.mp3", "myAudio");
        accAudio = new Sound("accident.mp3", "accAudio");
        accAudio.sound.autoplay = false;
        accAudio.playing = false;
    }
    catch(err){
        console.log("music file not available");
    }

    /*
    configuring the webgl program and adding shaders
    */
    program = gl.createProgram();
    vertShdr = createShaderHelper(vertexShader, true);
    fragShdr = createShaderHelper(fragShader, false);

    gl.attachShader( program, vertShdr );
    gl.attachShader( program, fragShdr );
    gl.linkProgram( program );
    gl.useProgram( program );

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    //location of uniform transformation matrices in webgl program
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    //make patch and assign colors
    makeSmallPatches();
    

    //make buffers and link them to the program
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW );
    var vertexPosition = gl.getAttribLocation( program, "vertexPosition" );
    gl.vertexAttribPointer( vertexPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vertexPosition );

    vertexColor = gl.createBuffer();
    setColors();
    var vColor = gl.getAttribLocation(program, "vertexColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    //inspired from Anisa recitation
    normalBuffer = gl.createBuffer();
    setNormals();
    console.log(vertices.length, colors.length, vNormals.length)
    var vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);

    var ambientProduct = mult(lightAmbient, materialAmbient);
    var diffuseProduct = mult(lightDiffuse, materialDiffuse);
    var specularProduct = mult(lightSpecular, materialSpecular);

    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"),
        flatten(ambientProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"),
        flatten(diffuseProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"),
        flatten(specularProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"),
        flatten(lightPosition));

    gl.uniform1f(gl.getUniformLocation(program,
            "shininess"), materialShininess);

    //set initial camera vectors, defaults all angles to 0.
    getRotations();
    animate(0);
}

//to map the color of the vertices according to its y value
function mapPoint(P, Q, X, A, B) {
    var alpha = (((Q-P)*(Q-P) > 0 ) ? (X - P)/(Q - P) : 0);
    var result;

	if (typeof P == "number" && typeof A == "number") {
        result = alpha*B + (1 - alpha)*A;
    }

    else {
        result = [];
        for (let i = 0; i < A.length; i++) {
            result.push(alpha*B[i] + (1 - alpha)*A[i])
        }
    }

    return result
}

//helpder function to create shaders
function createShaderHelper(sourceString, vertex = true) {
    var shader = ((vertex) ? gl.createShader( gl.VERTEX_SHADER ) : gl.createShader( gl.FRAGMENT_SHADER ));
    gl.shaderSource( shader, sourceString );
    gl.compileShader( shader );
    return shader;
}

function getPatch(xmin, xmax, zmin, zmax) {
    //length of side of each triangle
    var scl = 0.1;

    //seeding the noise function to generate random terrain
    noise.seed(Math.random());

    /*
    generates the terrain. Close to Edge function is used to
    handle the boundary values close to edge of the terrain
    */
    verticesStart = vertices.length;
    for (let z = zmin; z < zmax; z += scl) {
        for (let x = xmin; x < xmax; x += scl) {
            var factor = closeToEdge(x, z, xmin, xmax, zmin, zmax, 2)
            let a = vec4(x, noise.perlin2(x, z) * factor, z, 1.0);
            factor = closeToEdge(x + scl, z, xmin, xmax, zmin, zmax, 2)
            let b = vec4(x + scl, noise.perlin2(x + scl, z) * factor, z, 1.0);
            factor = closeToEdge(x, z+scl, xmin, xmax, zmin, zmax, 2)
            let c = vec4(x, noise.perlin2(x, z + scl) * factor, z + scl, 1.0);
            factor = closeToEdge(x + scl, z + scl, xmin, xmax, zmin, zmax, 2)
            let d = vec4(x + scl, noise.perlin2(x + scl, z + scl) * factor, z + scl, 1.0);
            vertices.push(a); vertices.push(b); vertices.push(c);
            vertices.push(add(d, vec4(0,0,0,0))); vertices.push(add(c, vec4(0,0,0,0))); vertices.push(add(b, vec4(0,0,0,0)));
        }
    }

     
    for (var k = verticesStart; k < vertices.length; k += 3)
    {
        a = vertices[k];
        b = vertices[k + 1];
        c = vertices[k + 2];
        if (!(a in verticesFaces))
        {   
            verticesFaces[a] = []
        }
        verticesFaces[a].push(faceNum)

        if (!(b in verticesFaces))
        {   
            verticesFaces[b] = []
        }
        verticesFaces[b].push(faceNum)

        if (!(c in verticesFaces))
        {   
            verticesFaces[c] = []
        }
        verticesFaces[c].push(faceNum)
        //verticesFaces has key = vertex, value = a list of all faces conntected to it

        faces[faceNum++] = [a,b,c, getNormal(a,b,c)];
        //faces has key = faceNum and key = vertices conntected to it and the normal
        
    }

    return verticesStart
}

function closeToEdge(x, z, xmin, xmax, zmin, zmax, threshold) {
    var xDiff = 2;
    var zDiff = 2;

    if (Math.abs(x - xmin) <= threshold || Math.abs(x - xmax) <= threshold)
    {
        xDiff = Math.min(Math.abs(x - xmin),Math.abs(x - xmax))
    }

    if (Math.abs(z - zmin) <= threshold || Math.abs(z - zmax) <= threshold)
    {
        zDiff = Math.min(Math.abs(z - zmin), Math.abs(z - zmax));
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

/*
translates the eye and at vectors along the
new axis of translation, that is, the camera's new
z-axis (which is simply the rotated at vector)
*/
function translate(axis){
    for (var i = 0; i < axis.length; i++) {
        eye[i] += ourPlane.speed * axis[i];
        at[i] = atRotated[i] + ourPlane.speed * axis[i];
    }

    atRotated = at;
    eyeRotated = eye;
}

//rotate the camera axes to generate rotated camera vectors
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
    upRotated = up;
}

function getNormalAverage(normals)
{
    var normal = normals[0]
    for (let k = 1; k < normals.length; k ++)
    {
        normal = add(normal, normals[k])
    }
    if ( !isFinite(length(normal)) ) {
        return vec3()
    } 
    return normalize(normal)
}

function getNormal(a, b, c)
{
    //Anisa recitation code

    var t1 = subtract(b, a);
    var t2 = subtract(c, a);
    var normal = cross(t1, t2);
    var normal = vec3(normal);
    return normal
}

function animate(time){
    if (simulatorRunning) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        translate(atVector);

        // if (atRotated[1] > 3.5)
        //     atRotated[1] = 3.5;
        // else (atRotated[1] < 2.5)
        //     atRotated[1] = 2.5;
        // if (contrained) {
        //     atRotated[1] = atRotatedStored
        //     upRotated[1] = upStored;
        //     if (eyeRotated[1] > 2.5 || eyeRotated[1] < 3.5) {
        //         contrained = false;
        //     }
        // }

        // if (eyeRotated[1] < 2.5 && !contrained) {
        //     lastEye = eyeRotated[1];
        //     eyeRotated[1] = 2.5;
        //     atRotatedStored = atRotated[1];
        //     upStored = upRotated[1];
        //     contrained = true;
        //     lastPitch = ourPlane.pitch;
        // }

        // if (eyeRotated[1] > 3.5 && !contrained) {
        //     lastEye = eyeRotated[1];
        //     eyeRotated[1] = 3.5;
        //     atRotatedStored = atRotated[1];
        //     upStored = upRotated[1];
        //     contrained = true;
        //     lastPitch = ourPlane.pitch;
        // }


        if (currentPatch(atRotated) != cPatch) {
            var oPatch = cPatch;
            cPatch = currentPatch(atRotated);
            if (oPatch != -1)
            {
                changeOfPatch(oPatch, cPatch);
            }
        }

<<<<<<< Updated upstream
        
=======

        /*
        get transformation matrices corresponding to current coordinates
        and pass to webgl program.
        */
>>>>>>> Stashed changes
        projectionMatrix = ortho(left, right, bottom, ytop, near, far);
        modelViewMatrix = lookAt(eyeRotated, atRotated, upRotated);
        gl.uniformMatrix4fv( modelViewMatrixLoc, false, flatten(modelViewMatrix) );
        gl.uniformMatrix4fv( projectionMatrixLoc, false, flatten(projectionMatrix) );

        if (viewMode % 3 === 0){ // points
            gl.drawArrays(gl.POINTS, 0, vertices.length);
        }
    
        else if (viewMode % 3 === 1){ //wireframe
            gl.drawArrays(gl.LINES, 0, vertices.length);
        }
        else if (viewMode  % 3 > 1){ // shading involved
            gl.drawArrays( gl.TRIANGLES, 0, vertices.length );
        }
    
    }
    window.requestAnimationFrame(animate);
}

function enableAllBuffers(){
    
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    
    
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

    //inspired from Anisa recitation
    normalBuffer = gl.createBuffer();
    setNormals();
    var vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);

    var ambientProduct = mult(lightAmbient, materialAmbient);
    var diffuseProduct = mult(lightDiffuse, materialDiffuse);
    var specularProduct = mult(lightSpecular, materialSpecular);

    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"),
        flatten(ambientProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"),
        flatten(diffuseProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"),
        flatten(specularProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"),
        flatten(lightPosition));

    gl.uniform1f(gl.getUniformLocation(program,
            "shininess"), materialShininess);
}

function enablePhongShading(){
    if (!phongBool){
        console.log(ka + " " + kd + " " + ks);
        phongBool = true;
        gl.detachShader(program, vertShdr);
        gl.detachShader(program, fragShdr);

        vertShdr = createShaderHelper(vertexShaderPhong, true);
        fragShdr = createShaderHelper(fragShaderPhong, false);
            
        gl.attachShader( program, vertShdr );
        gl.attachShader( program, fragShdr );

        gl.linkProgram( program );
        gl.useProgram( program );

        gl.uniform1f(gl.getUniformLocation(program,
            "Ka"), ka);
        gl.uniform1f(gl.getUniformLocation(program,
            "Kd"), kd);
        gl.uniform1f(gl.getUniformLocation(program,
            "Ks"), ks);

        enableAllBuffers();
    }
}

function disablePhongShading(){
    if (phongBool){
        console.log("disabled")
        gl.detachShader(program, vertShdr);
        gl.detachShader(program, fragShdr);

        vertShdr = createShaderHelper(vertexShader, true);
        fragShdr = createShaderHelper(fragShader, false);
            
        gl.attachShader( program, vertShdr );
        gl.attachShader( program, fragShdr );

        gl.linkProgram( program );
        gl.useProgram( program );

        enableAllBuffers();
    }
    phongBool = false;
}


function shareRow(patch1, patch2) {
    var a = BOTTOMROW.includes(patch1) && BOTTOMROW.includes(patch2);
    var b = MIDDLEROW.includes(patch1) && MIDDLEROW.includes(patch2);
    var c = TOPROW.includes(patch1) && TOPROW.includes(patch2);
    return a || b || c
}

function changeOfPatch(oPatch, newPatch) {
    if (shareRow(oPatch, newPatch)) {
        if (LEFTCOL.includes(newPatch)) {
            translatePatches(RIGHTCOL, 30, 0);
            oldRight = RIGHTCOL; oldMiddle = MIDDLECOL; oldLeft = LEFTCOL;
            MIDDLECOL = oldLeft;
            RIGHTCOL = oldMiddle;
            LEFTCOL = oldRight;
        }

        if (RIGHTCOL.includes(newPatch)) {
            translatePatches(LEFTCOL, -30, 0);
            oldRight = RIGHTCOL; oldMiddle = MIDDLECOL; oldLeft = LEFTCOL;
            MIDDLECOL = oldRight;
            LEFTCOL = oldMiddle;
            RIGHTCOL = oldLeft;
        }
    }

    else {
        if (TOPROW.includes(newPatch)) {
            translatePatches(BOTTOMROW, 0, 30);
            oldBottom = BOTTOMROW; oldTop = TOPROW; oldMiddle = MIDDLEROW;
            MIDDLEROW = oldTop;
            BOTTOMROW = oldMiddle;
            TOPROW = oldBottom;
        }

        if (BOTTOMROW.includes(newPatch)) {
            translatePatches(TOPROW, 0, -30);
            oldBottom = BOTTOMROW;
            oldTop = TOPROW;
            oldMiddle = MIDDLEROW;
            MIDDLEROW = oldBottom;
            TOPROW = oldMiddle;
            BOTTOMROW = oldTop;
        }
    }
}

function translatePatches(patchesNum, tx, tz) {
    for (let i = 0; i < patchesNum.length; i++) {

        start = patchOffset[patchesNum[i]];
        end = (patchesNum[i] === 8) ? vertices.length: patchOffset[patchesNum[i] + 1];

        for (let index = start; index < end; index++) {
            vertices[index][0] += tx;
            vertices[index][2] += tz;
        }

        patchBoundaries[patchesNum[i]][0] += tx;
        patchBoundaries[patchesNum[i]][1] += tx;
        patchBoundaries[patchesNum[i]][2] += tz;
        patchBoundaries[patchesNum[i]][3] += tz;
    }

    gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
    gl.bufferSubData( gl.ARRAY_BUFFER, 0, flatten(vertices));
}

var patchBoundaries = [];
var patchOffset = []

var LEFTCOL = [2, 5, 8];
var RIGHTCOL = [0, 3, 6];
var MIDDLECOL = [1, 4, 7];

var BOTTOMROW = [0, 1, 2];
var MIDDLEROW = [3, 4, 5];
var TOPROW = [6, 7, 8];

function makeSmallPatches() {
    p1 = [-15, -5, -15, -5];
    patchBoundaries.push(p1);

    p2 = [-5, 5, -15, -5];
    patchBoundaries.push(p2);

    p3 = [5, 15, -15, -5];
    patchBoundaries.push(p3);

    p4 = [-15, -5, -5, 5];
    patchBoundaries.push(p4);

    p5 = [-5, 5, -5, 5];
    patchBoundaries.push(p5);

    p6 = [5, 15, -5, 5];
    patchBoundaries.push(p6);

    p7 = [-15, -5, 5, 15];
    patchBoundaries.push(p7);

    p8 = [-5, 5, 5, 15];
    patchBoundaries.push(p8);

    p9 = [5, 15, 5, 15];
    patchBoundaries.push(p9);

    for (let i = 0; i < patchBoundaries.length; i++)
    {
        var patch = patchBoundaries[i]
        patchOffset.push(getPatch(patch[0], patch[1], patch[2], patch[3]));
    }

}

function currentPatch(currentPos)
{

    x = currentPos[0];
    z = currentPos[2];

    for (let i = 0; i < patchBoundaries.length; i++)
    {
        var patch = patchBoundaries[i];
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


function setColors()
{
    
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

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexColor);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
}


var normalFlat = []
var normalSmooth =[]

function setNormals(){

    // vNormal[i] refers to the normal for vertices[i]
    if (normalFlat.length == 0){ // flat shading, Phong shading
        
        // adding Phong here:
        // add Normals at each vertex and interpolate bw them for all vertices between them
        // this interpolation will be done by the varying keyword in GLSL


        for (let k = 0; k < faceNum; k++)
        {
            faceNormal = faces[k][3];
            for (let i = 0; i < 3; i++)
            {
                normalFlat.push(faceNormal); //face normal added 3 times for each vertex
            }
        
        }
        
    }
    if (normalSmooth.length == 0){ // smooth shading
        for (let k = 0; k < vertices.length; k++)
        {
            var vertexNormals = []
            var attachedFaces = verticesFaces[vertices[k]];
            for (let i = 0; i < attachedFaces.length; i++)
            {
                //normals of all faces assoicated with that normal
                vertexNormals.push(faces[attachedFaces[i]][3]);
            }   
            normalSmooth.push(getNormalAverage(vertexNormals)); //average normal

        }

    }   


    if (fill % 3 == 0)
    {
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(normalFlat), gl.STATIC_DRAW);  
    } 
    else
    {
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(normalSmooth), gl.STATIC_DRAW);   
    }
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

    else if (event.code === 'KeyC'){ // toggle shade
        fill = fill + 1;
        //colors = setColors(); // sets the colors array
        setNormals(); //changing normals for the shading 

        if (fill % 3 === 2){
            enablePhongShading();
        }
        else
        {
            disablePhongShading();
        }
    }
    else if (event.code === 'KeyV'){ // toggle view
        viewMode += 1;
    }

    //for rotation. updates the rotation angles taking into account limits
    else if (event.code === 'KeyW' || event.code === 'KeyS' ||
             event.code === 'KeyE' || event.code === 'KeyA' ||
             event.code === 'KeyD' || event.code === 'KeyQ' ){

        if (event.code === 'KeyW' && ourPlane.pitch < 89.5) {
            ourPlane.pitch += 0.5;
            ourPlane.pitchRotate = 0.5;
            getRotations();
        }

        else if (event.code === 'KeyS' && ourPlane.pitch > -90.5) { //
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

    else if (event.keyCode === 38){ //increase speed
        ourPlane.speed = Math.min(ourPlane.speed + 0.01, ourPlane.maxSpeed);
        if (ourPlane.speed > ourPlane.maxSpeed/3){
            if (!accAudio.playing) {
                accAudio.sound.play();
                accAudio.playing = true;
                ourAudio.tuneAudio();
            }
        }
    }

    else if (event.keyCode === 40){ //decrease speed
        ourPlane.speed = Math.max(ourPlane.speed - 0.01, ourPlane.minSpeed);
        if (ourPlane.speed < ourPlane.maxSpeed/3){
            if (accAudio.playing) {
                accAudio.sound.pause();
                ourAudio.tuneAudio();
                accAudio.playing = false;
            }
        }
    }

    else if (event.keyCode === 27) { //escape key. pauses simulator
        if (simulatorRunning) simulatorRunning = false;
        else simulatorRunning = true;
    }

    else if (event.code === 'KeyP'){ //music
        try {
            ourAudio.tuneAudio();
        }
        catch(err){
            console.log("music file not available");
        }
    }
}

/*
triggered when the user stops pressing the key.
sets the rotating angle for next iteration to 0
*/
function getKeyUp(event){
    if (event.code === 'KeyW') this.pitchRotate = 0;
    else if (event.code === 'KeyS') this.pitchRotate = 0;
    else if (event.code === 'KeyA') this.yawRotate = 0;
    else if (event.code === 'KeyD') this.yawRotate = 0;
    else if (event.code === 'KeyQ') this.rollRotate = 0;
    else if (event.code === 'KeyE') this.rollRotate = 0;
}
