// the Node object and its properties
// Constructor takes either a string (creates new node with name=title) or
// another Node object (creates duplicate of node but with new UID)
window.Node = function(val) {
  if (typeof val == 'string') {
    this.name = val;  // the current node's name
    this.children = new Array(); // the children
    this.prereqs = new Array(); // array of pointers to the prerequisite nodes
    this.skillType = 'skill'; // the skill type associated with the current node ["skill", "clique", "chain"]
    this.completed = false; // if the node is completed
    this.time = 0; // estimated number of seconds required to complete this node's task. 
    this.tools = []; // tools necessary for use dependent on the skill. 
    this.renderWidth = 0; // base render width in pixels
    this.agent = null;
  } else if (typeof val == 'object') {
    // Copy Constructor
    this.name = val.name;
    if (typeof this.name == 'undefined') this.name = '';
    this.uid = val.uid;
    this.children = new Array();
    if (typeof val.children != 'undefined') {
      for (var i = 0; i < val.children.length; ++i)
        this.children.push(new Node(val.children[i]));
    }
    this.prereqs = val.prereqs;
    this.skillType = val.skillType;
    this.completed = val.completed;
    this.time = val.time;
    this.tools = val.tools;
    this.renderWidth = val.renderWidth;
    this.agent = val.agent;    
  } else {
    console.log("ERROR -- Bad type given to Node constructor: "+ (typeof val));
  }
  
  if (typeof this.uid == 'undefined') {
    this.assignNewUID();
  }
}

window.Node.prototype.assignNewUID = function () {
    this.uid = 'node_UID_'+this.name.replace(/ /g,"-")+'_'+(Node.uid_counter); // generate unique ID
    console.log("GENERATING UID for " + this.name + ": " + this.uid);
    ++Node.uid_counter;
}

window.Node.uid_counter = Math.round(10000*Math.random());



// Returns true if skillType is not "skill" (can be either 'clique' or 'chain')
window.Node.prototype.isMetaNode = function () {
  return (this.skillType != "skill");
}

/**
 * Determine the width of the node's box-shaped container by evaluating how wide its children must be
 */
window.Node.prototype.findRenderWidth = function(minRenderWidth, head){
  var curWidth = 0;
  var node = this;

  if (node.children.length == 0) {
    if (node == head)
      curWidth = $('.mainTask').width(); // if head needs to be wider. 
    else
      curWidth = minRenderWidth; // default if no children
  }

  for (var i = 0; i < node.children.length; i++) {
    curWidth += node.children[i].findRenderWidth(minRenderWidth, head);
  }

  node.renderWidth = curWidth;
  //console.log("Node " + this.name + " width: " + curWidth);
  return curWidth;
}


/**
 * Aggregates the tools required for this node by traversing its children
 */
window.Node.prototype.getNodeTools = function () {
  var node = this;
  if (node.children.length == 0) {
    return node.tools;
  }
  else {
    node.tools = [];
    for (var i = 0; i < node.children.length; i++) { // step through each child
      var childTools = node.children[i].getNodeTools();
      if (childTools == null) continue;
      for (var j = 0; j < childTools.length; j++) { // step through each tool of each child
        if (!arrayContains(node.tools, childTools[j])) {
          node.tools.push(childTools[j]);
        }
      }
    }
  }
  return node.tools;
}

/**
 * Aggregates unique prerequisites from all child nodes
 */
window.Node.prototype.getNodePrereqs = function() {
  /*
  var node = this; 
  if (node.children.length == 0) {
    return node.prereqs; 
  } else { // parent node
    node.prereqs = new Array();
    for (var i = 0; i < node.children.length; i++) {
      // For each child node--
      var childPrereqs = node.children[i].getNodePrereqs();
      
      // Remove any elements from node.prereqs that is in childPrereqs
      for (var j = 0; j < node.prereqs.length; j++) {
        if (!arrayContains(childPrereqs, node.prereqs[j])) {
          var target = node.prereqs[j] // to be deleted
          node.prereqs = jQuery.grep(node.prereqs, function(value) {
            return value != target;
          });
          --j; // decriment because just removed an item. 
        }
      }
      
      node.prereqs = node.prereqs.concat(childPrereqs); // Concatenate node.prereqs and childPrereqs
    }
  }
  return node.prereqs; 
  */
  return this.prereqs;
}



window.Node.prototype.setCompleted = function (state) {
  this.completed = state;

  if (this.children.length == 0) {
    return;
  }
  
  for (var i = 0; i < this.children.length; ++i) {
    this.children[i].setCompleted(state);
  }
}

/**
 * Returns whether this node (or all its children, if not a leaf node) are marked as completed
 */
window.Node.prototype.isNodeCompleted = function() {
  var node = this;
  if (node.children.length == 0) { // if no children just look at local 'completed' var
    return node.completed;
  }

  var completed = true;

  // if one child is false, completed = false, but continue to go through all children. 
  // so that meta-nodes are all updated
  for (var i = 0; i < node.children.length; i++) {
    if (node.children[i].isNodeCompleted() == false) {
      node.completed = false;
      completed = false;
    }
  }
  node.completed = completed;
  return completed;
}

/**
 * Returns the total estimated aggregate time for all child node skills to be completed
 */
window.Node.prototype.getTimeNode = function () {
  var node = this;
  if (node.children.length == 0)
    return node.time;

  var totalTime = 0;
  for (var i = 0; i < node.children.length; i++) {
    totalTime += node.children[i].getTimeNode();
  }
  node.time = totalTime;
  return totalTime;
}

window.Node.applyToAllNodes = function (node, func) {
  func(node);
  
  for (var i = 0; i < node.children.length; ++i) {
    Node.applyToAllNodes(node.children[i], func);
  }
}

window.Node.findNodeById = function (head, node_id) {
  if (head.uid == node_id) return head;
  for (var i=0;i<head.children.length;++i) {
     var result = Node.findNodeById(head.children[i], node_id);
     if (result != null) return result;
  }
  return null;
}


window.Node.convertToPortableFormat = function (node) {
    var new_node = new Node(node);
    
    var consolidate_prereqs = function (node) {
      var prereqs = node.getNodePrereqs();
      node.prereqs = new Array();
      for (var i = 0; i < prereqs.length; ++i) {
        node.prereqs.push(prereqs[i].uid);
      }
    }

    var rename_field_from_name_to_skill = function (node) {
      node.skill = node.name;
      delete node.name;
    }

    var aggregate_parameters = function (node) {
      node.parameters = new Object();
      node.parameters.time = node.time;
      node.parameters.tools = node.tools.join(",");
    }

    Node.applyToAllNodes(new_node, consolidate_prereqs);
    Node.applyToAllNodes(new_node, rename_field_from_name_to_skill);
    Node.applyToAllNodes(new_node, aggregate_parameters);
    
    console.log("Portable node:");
    console.log(new_node);
    return new_node;
}

window.Node.serializeJSON = function (node) {
    // Convert Node tree into CCHTN JSON format
    /*
      Each node has parameters: {'parent': 'node-name'}
      Each metanode has parameters: {'graph': self._graph_type(), 'initiation_nodes': [], 'termination_nodes': []}
    */

    return JSON.stringify(node)
}

window.Node.unserializeJSON = function (node_json) {
  var pre_node = JSON.parse(node_json);
  
  var rename_field_from_skill_to_name = function (node) { node.name = node.skill; delete node.skill;  };
  var decompress_parameters = function (node) {
    if (typeof node.parameters != 'undefined') {
      if (typeof node.parameters.time != 'undefined')
        node.time = node.parameters.time;
      else console.log("No time on node " + node.name);
      if (typeof node.parameters.tools != 'undefined')
        node.tools = node.parameters.tools.split(",");
    } else { console.log("No params:"); console.log(node); }
  };
  
  var set_complete = function(node) {
    if (typeof node.completed == 'undefined')
      node.completed = false;
  }
 
  Node.applyToAllNodes(pre_node, rename_field_from_skill_to_name);
  Node.applyToAllNodes(pre_node, set_complete);
  Node.applyToAllNodes(pre_node, decompress_parameters);
 
  var new_node = new Node(pre_node);
  
  // Search for nodes matching string ids in the array "node.prereqs"
  var find_prereqs = function(node) {
    node.populatePrereqs(new_node);
  }
  Node.applyToAllNodes(new_node, find_prereqs);
  console.log("Unserialized_node = " + new_node);
  return new_node;
}

window.Node.prototype.populatePrereqs = function (head) {
  if (typeof this.prereqs == 'undefined') {
    this.prereqs = [];
    return;
  }

  var prereq_ids = this.prereqs;
  var new_prereqs = new Array();

  for (var i=0;i<prereq_ids.length;++i) {
    var target_id = prereq_ids[i];
    var node = window.Node.findNodeById(head,target_id);
    if (node != null) {
      new_prereqs.push(node);
      console.log("Found prereq for " + head.name + " with id: " + target_id);
    } else {
      console.log("Couldn't find prereq for " + head.name + " with id: " + target_id);
    }
  }
  this.prereqs = new_prereqs;
}






































































