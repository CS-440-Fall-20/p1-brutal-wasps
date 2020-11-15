var TRIANGLE_MODE = 0;
var QUAD_MODE = 1;
var gl;
var program;
var vertShdr;
var fragShdr;
var colorBuffer;
var vertexBuffer;
var normalBuffer;
var ambBuffer;
var vertexColor;
var vertexPosition;

var points = [];
var colors = [];
var points1 = [];
var vertices = [];
var vNormals = [];
var verticesFaces = {};

var modelViewMatrix = mat4();
var projectionMatrix = mat4();
var normalMatrix;
var theta = 0;
var phi = 0;
var radius = 0.0;
var faces = {}
var faceNum = 0;
var phongBool = false;

var x_pos = 0;
var y_pos = 2;
var z_pos = -2;
var diff = 1;
var mov_speed = 0.01;
var at = vec3(x_pos, y_pos, 5);
const up = vec3(0.0, 1.0, 0.0);

const WHITE = vec4(1, 1, 1, 1);
const BLUE = vec4(0, 0, 1, 1);
const GREEN = vec4(0, 1, 0, 1);
const BROWN = vec4(210/255, 105/255, 30/255, 1);
// adding ortho params that can be altered
var left = -2.5;
var right = 2.5;
var ytop = 0.5;
var bottom = -3;
var near = -2.5;
var far = 2.5;



// camera movement speed
const speed = 0.03;

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
var ka = 0.0;
var kd = 1.0;
var ks = 1.0;

// get key press event listener 
document.addEventListener('keypress', getKeyPress);

//vertex shader in general
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

// vertexShader for Phong shading
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

window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );
    gl = canvas.getContext("webgl");
    if ( !gl ) 
	{
        alert( "WebGL isn't available" );
    }

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
    getPatch(-5, 5, -5, 5);

    eye = vec3(x_pos,
    y_pos,
    z_pos - diff);
    
    enableAllBuffers();

    //render()
    setNormals();
    setColors();
    animate(0);
}

function mapPoint(P, Q, X, A, B)
{

    //Anisa reciation code  
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
    for (let z = zmin; z < zmax; z += scl)
	{
        for (let x = xmin; x < xmax; x += scl)
		{
            let a = vec4(x, (Math.random()*4 - 2), z, 1.0);
            let b = vec4(x + scl, (Math.random()*4 - 2), z, 1.0);
            let c = vec4(x, (Math.random()*4 - 2), z + scl, 1.0);
            let d = vec4(x + scl, (Math.random()*4 - 2), z + scl, 1.0);
            points.push(a); points.push(b);
            points.push(a); points.push(c);
            points.push(a); points.push(d);
            points.push(b); points.push(d);
            points.push(c); points.push(d);
            
            vertices.push(a); vertices.push(b); vertices.push(c);
            vertices.push(d); vertices.push(c); vertices.push(b);
        }
    }
	
    for (var k = 0; k < points.length; k++)
    {
        points[k][1] = noise.perlin2(points[k][0], points[k][2]);
        colors.push(vec4(1.0, 1.0, 1.0, 1.0));
    }

    for (var k = 0; k < vertices.length; k += 3)
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
    //console.log(Object.keys(verticesFaces).length);
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

function animate(time)
{
    //console.log(vNormals.length);
    //console.log(vertices.length);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    z_pos += mov_speed;
    at[2] = z_pos;
    eye = vec3(x_pos, y_pos, z_pos - diff);
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);
    modelViewMatrix = lookAt(eye, at , up);
    gl.uniformMatrix4fv( modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    gl.uniformMatrix4fv( projectionMatrixLoc, false, flatten(projectionMatrix) );


    if (viewMode % 3 === 0){ // points
        gl.drawArrays(gl.POINTS, 0, vertices.length);
    }

    else if (viewMode % 3 === 1){ //wireframe
        gl.drawArrays(gl.LINES, 0, vertices.length);
    }
    else if (viewMode  % 3 > 1){ // shading involved
        if (fill % 4 === 3){
            enablePhongShading();
        }
        else
            disablePhongShading();

        gl.drawArrays( gl.TRIANGLES, 0, vertices.length );
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
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vNormals), gl.STATIC_DRAW);
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

function getVertexColor(vertex)
{
    if (vertex[1] > 0.6)
    {
        color = WHITE;
    }
    else if (vertex[1] > 0.33)
    {
        color = BROWN;
        color = mapPoint(0.33, 0.6, vertex[1], BROWN, WHITE)
    }
    else if (vertex[1] > 0)
    {
        color = GREEN;
        color = mapPoint(0, 0.33, vertex[1], GREEN, BROWN)
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


function setNormals(){

    // vNormal[i] refers to the normal for vertices[i]
    if (fill % 3 == 0){ // flat shading, Phong shading
        
        // adding Phong here:
        // add Normals at each vertex and interpolate bw them for all vertices between them
        // this interpolation will be done by the varying keyword in GLSL

        vNormals = [];

        for (let k = 0; k < faceNum; k++)
        {
            faceNormal = faces[k][3];
            for (let i = 0; i < 3; i++)
            {
                vNormals.push(faceNormal); //face normal added 3 times for each vertex
            }
        
        }
        
    }
    else if (fill % 3 === 1 || fill % 3 === 2){ // smooth shading
        vNormals = [];
        for (let k = 0; k < vertices.length; k++)
        {
            var vertexNormals = []
            var attachedFaces = verticesFaces[vertices[k]];
            for (let i = 0; i < attachedFaces.length; i++)
            {
                //normals of all faces assoicated with that normal
                vertexNormals.push(faces[attachedFaces[i]][3]);
            }   
            vNormals.push(getNormalAverage(vertexNormals)); //average normal

        }

    }   

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vNormals), gl.STATIC_DRAW);   
}

function getKeyPress(event){
    if (event.code === 'Numpad4'){ // left
        left = left - speed;
        right = right - speed;
    }
    else if (event.code === 'Numpad6'){ // right
        left = left + speed;
        right = right + speed;
    }
    else if (event.code === 'Numpad8'){ // up
        ytop = ytop + speed;
        bottom = bottom + speed;
    }
    else if (event.code === 'Numpad2'){ // down
        ytop = ytop - speed;
        bottom = bottom - speed;
    }
    else if (event.code === 'Numpad5'){ // in
        near = near - speed;
        far = far - speed;
    }
    else if (event.code === 'Numpad0'){ // far
        near = near + speed;
        far = far + speed;
    }
    else if (event.code === 'KeyC'){ // toggle shade
        fill = fill + 1;
        //colors = setColors(); // sets the colors array
        setNormals(); //changing normals for the shading 
         
    }
    else if (event.code === 'KeyV'){ // toggle view
        viewMode += 1;
    }
}