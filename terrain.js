var TRIANGLE_MODE = 0;
var QUAD_MODE = 1;
var gl;
var colorBuffer;
var vertexBuffer;
var vertexColor;
var vertexPosition;
var points = [];
var colors = [];
var points1 = [];

var colors = [];
var modelViewMatrix = mat4();
var projectionMatrix = mat4();
var theta = 45;
var phi = 45;
var radius = 0.05;
const at = vec3(0.0, 0.0, 0.0);
const up = vec3(0.0, 1.0, 0.0);

//vertex shader
var vertexShader = `
attribute vec4 vertexPosition;
attribute vec4 vertexColor;
varying vec4 color;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
void main()
{
    gl_Position = projectionMatrix * modelViewMatrix * vertexPosition;
    color = vec4(1.0, 1.0, 1.0, 1.0);
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

window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );
    gl = canvas.getContext("webgl");
    if ( !gl ) 
	{
        alert( "WebGL isn't available" );
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

    eye = vec3(radius*Math.sin(theta)*Math.cos(phi),
                radius*Math.sin(theta)*Math.sin(phi),
                radius*Math.cos(theta));

    var modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    var projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    
	modelViewMatrix = lookAt(eye, at , up);
    projectionMatrix = ortho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);

    gl.uniformMatrix4fv( modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    gl.uniformMatrix4fv( projectionMatrixLoc, false, flatten(projectionMatrix) );

    vertexBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );
    
	var vertexPosition = gl.getAttribLocation( program, "vertexPosition" );
    
	gl.vertexAttribPointer( vertexPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vertexPosition );

    getPatch(-5, 5, -5, 5);
    render()
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
        }
    }
	
    for (var k = 0; k < points.length; k++)
         points[k][1] = noise.perlin2(points[k][0], points[k][2]);

}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer( gl.ARRAY_BUFFER, vertexBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW );
    gl.drawArrays( gl.LINES, 0, points.length );
}

