var node1 = new Node("Make Salad");
node1.skillType="chain";

var node2 = new Node("Make Dressing");
node2.skillType="clique";


var node3 = new Node("Add Salt");
node3.time = 70;
node3.tools = [ "salt shaker"];
//node3.completed = true; 

var node4 = new Node("Add Vinegar");
node4.time = 60;
node4.tools = ["bowl", "bowl1", "bowl2", "bowl3", "bowl4"];
//node4.completed = true; 

var node5 = new Node("Add Olive Oil");
node5.time = 60;
node5.tools = ["bowl"];
//node5.completed = true; 

var node6 = new Node("Prep Veggies");
node6.skillType="clique";


var node7 = new Node("Prep Tomatoes");
node7.skillType = "chain";
//node7.completed = true; 

var node8 = new Node("Cut Tomatoes");
node8.time = 200;
node8.tools = ["knife"];
node8.prereqs = [node4, node5]; 
//node8.completed = true;  

var node9 = new Node("Add Tomatoes");
node9.time = 20;
node9.tools = ["bowl"];
node9.prereqs = [node4]; 
//node9.completed = true; 

var node10 = new Node("Add Carrots");
node10.time = 20;
node10.tools = ["bowl"];
//node10.completed = true; 

var node11 = new Node("Mix Salad");
node11.time = 75;
node11.tools = ["bowl"];
node11.prereqs = [node3, node4, node5];
//node11.completed = true; 

// adds in relationships 
node1.children = [node2, node6, node11];
node2.children = [node3, node4, node5];
node6.children = [node10, node7];
node7.children = [node8, node9];

var node12 = new Node("Primitive 0");
node12.skillType = "skill"
node12.time = 10;
node12.tools = ["Tool for Prim 0"];
var node13 = new Node("Primitive 1");
node13.skillType = "skill";
node13.time = 11;
node13.tools = ["Tool for Prim 1"];
var node14 = new Node("Primitive 2");
node14.skillType = "skill"
node14.time = 12;
node14.tools = ["Tool for Prim 2"];
var node15 = new Node("Primitive 3");
node15.skillType = "skill"
node15.time = 13;
node15.tools = ["Tool for Prim 3"];
var node16 = new Node("Primitive 4");
node16.skillType = "skill"
node16.time = 13;
node16.tools = ["Tool for Prim 4"];
var node17 = new Node("Primitive 5");
node17.skillType = "skill"
node17.time = 13;
node17.tools = ["Tool for Prim 5"];
var node18 = new Node("Primitive 6");
node18.skillType = "skill"
node18.time = 13;
node18.tools = ["Tool for Prim 6"];
var node19 = new Node("Primitive 7");
node19.skillType = "skill"
node19.time = 13;
node19.tools = ["Tool for Prim 7"];
var node20 = new Node("Primitive 8");
node20.skillType = "skill"
node20.time = 13;
node20.tools = ["Tool for Prim 8"];
var node21 = new Node("Primitive 9");
node21.skillType = "skill"
node21.time = 13;
node21.tools = ["Tool for Prim 9"];
var node22 = new Node("Primitive 10");
node22.skillType = "skill"
node22.time = 13;
node22.tools = ["Tool for Prim 10"];
var node23 = new Node("Clique");
node23.skillType = "clique";
node23.time = 0;
node23.tools = [];
var node24 = new Node("Chain");
node24.skillType = "chain";
node24.time = 0;
node24.tools = [];
var primitives = [node23 ,node24, node12, node13, node14, node15, node16, node17, node18, node19, node20, node21, node22];
window.htn_server.primitives = primitives;
var tree = new TaskTree(window.htn_server, true);