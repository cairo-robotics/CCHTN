//window.cchtn_websocket_address = 'ws://192.168.1.108:9090' // Address of CCHTN ROS Node
window.cchtn_websocket_address = 'ws://127.0.0.1:9090' // Address of CCHTN ROS Node

/**
 * Object responsible for handling communication with the SHL Server over ROS.
 * Can be provided to a TaskTree object to render its contents.
 */
function Server(head, prefix, activeNodes, primitives) {
	this.head = head; 
	this.prefix = prefix; 
	this.activeNodes = activeNodes; 
	this.primitives = primitives; 

  //ROSBridge connection details 
  this.ros = new ROSLIB.Ros( { url: window.cchtn_websocket_address } );


  var server = this;
  this.setTree =  new ROSLIB.Service({ ros: server.ros, name: '/SetTaskHierarchy',  serviceType: 'core_task_hierarchy_server/SetTaskHierarchy' });
  this.saveTree = new ROSLIB.Service({ ros: server.ros, name: '/SaveTaskHierarchy', serviceType: 'core_task_hierarchy_server/SaveTaskHierarchy' });
  this.loadTree = new ROSLIB.Service({ ros: server.ros, name: '/LoadTaskHierarchy', serviceType: 'core_task_hierarchy_server/LoadTaskHierarchy' });
  this.getKnownTasks = new ROSLIB.Service({ ros: server.ros, name: '/GetKnownTasks', serviceType: 'core_task_hierarchy_server/GetKnownTasks' });
  this.getKnownSkills = new ROSLIB.Service({ ros: server.ros, name: '/GetKnownTasks', serviceType: 'core_task_hierarchy_server/GetKnownTasks' });
}

Server.prototype.loadKnownPrimitives = function () {
	var getSkillsCallReq    = new ROSLIB.ServiceRequest({});
	this.getKnownSkills.callService(getSkillsCallReq, function(result) {
		if (result.success === false) {
			alertify.error("Could not load Primitives.");
			return;
		}
		alertify.log("Loaded " + result.filenames.length + " primitives.")
		this.primitives = this.primitives.concat(result.filenames);
	})
}



// TaskTree object and its properties. 
// serverInfo contains parameters passed in from the CCHTN server --
//    serverInfo Params:
//      primitives: individual primitives names
//      head: root node of the tree being rendered
//      prefix: unique prefix for all HTML element IDs for this tree
//      activeNodes: array of UIDs of nodes currently being executed

function TaskTree(serverInfo, editMode) {
  this.server = serverInfo;
	this.head = serverInfo.head;
	this.prefix = serverInfo.prefix;
  this.containerId = this.prefix+"_container";
  this.primitiveBarId = this.prefix+"_primbar";
	this.activeNodes = serverInfo.activeNodes; // a list of unique IDs of nodes in use. 
	this.taskWidth = 200; 

  this.prefixID = "#" + this.prefix; 
	this.editMode = editMode; 
	this.activeTools = []; // a list of all the tools in use right now.
	this.primitives = serverInfo.primitives; // array of the primitive nodes.
	this.screen = '';
  this.filename = '';
}




TaskTree.prototype.showSaveDialog = function () {
  var thisTree  = this;
  var filename = thisTree.filename;
  if (filename.length == 0)
    filename = thisTree.head.name;
  if (filename.length == 0)
    filename = "MyTask";
  
  alertify.prompt("SAVE TREE<br/>Enter Filename:", 
                  function (e, str) {
                    if (e) {                      
                      thisTree.saveTree(str)
                    } else {
                      alertify.log("Save operation cancelled");
                    }
                  }, filename);
}

TaskTree.prototype.saveTree = function (filename) {
  var thisTree  = this;
   
  var setTreeCallReq = new ROSLIB.ServiceRequest({ serialized_head: JSON.stringify(Node.convertToPortableFormat(thisTree.head)) });
  var saveCallReq    = new ROSLIB.ServiceRequest({ task_file_name : filename });
  
  
  console.log(setTreeCallReq);
  this.server.setTree.callService(setTreeCallReq, function (result) {
    alertify.log("Success: " + result.success);
    if (result.success === true) {
      thisTree.server.saveTree.callService(saveCallReq, function (result) {
        if (result.success === true) {
          alertify.success("Task Hierarchy saved to " + filename + ".cchtn");
        } else {
          alertify.error("Task Hierarchy could not be saved to " + filename + ".cchtn");
        }
      });
    } else {
      alertify.error("Save aborted: could not set active tree in Task Hierarchy Server");
    } 
  });
}


TaskTree.prototype.showLoader = function () {
  var thisTree = this;
  var loader_id = this.prefix+'_loader';
  var selector_id = this.prefix+'_loader_selector';
  var curtain_id = this.prefix+'_loader_curtain';

  // Remove loader if it's already present
  var loader = $('#'+loader_id);
  if ($(loader).length > 0)
    $(loader).remove();
  
  
  var html = $('<div id="'+loader_id+'" class="loader"></div>');
  $(html).append('<div class="loader_title">Load Task Tree</div>');
  $(html).append('<div class="loader_selector"></div>');
  
  var selector = $('<select id="'+selector_id+'"></select>');
  
  var cancel = false;
  var getKnownTasksReq = new ROSLIB.ServiceRequest({task_file_name: $('#'+selector_id).val() });
  
  var success = this.server.getKnownTasks.callService(getKnownTasksReq, function (res) {
    console.log(res);
    if (res.success === false) { alertify.error("Load Task: Could not load known tasks list."); return false; }
    if (res.filenames.length == 0) { alertify.error("Load Task: No known tasks to load."); return false; }
    for (var i=0;i<res.filenames.length;++i) {
      alertify.log("Found Task: " + res.filenames[i]);
      $(selector).append('<option value="'+res.filenames[i]+'">'+res.filenames[i]+'</option>');
    }
    return true;
  }); 
  
  if (success === false) {
    alertify.log("Load Task Cancelled.");
    return;
  }
  
  
  $(html).find('.loader_selector').append(selector);

  var load_button = $('<button class="green_bg">Load Task</button>');
  $(load_button).click( function (e) {
    thisTree.loadTree($('#'+selector_id).val());
    var loader = $('#'+loader_id);
    var curtain = $('#'+curtain_id);
    $(loader).remove();
    $(curtain).remove();
    e.stopPropagation();
  });

  var cancel_button = $('<button class="red_bg">Cancel</button>');
  $(cancel_button).click( function (e) {
    var loader = $('#'+loader_id);
    var curtain = $('#'+curtain_id);
    $(loader).remove();
    $(curtain).remove();
    e.stopPropagation();
  });
  
  var controls = $('<div class="controls"></div>');
  $(controls).append(load_button);
  $(controls).append(cancel_button);
  
  $(html).append(controls);
  
  $(thisTree.screen).append(html); 
  $(thisTree.screen).append('<div class="loader_curtain" id="'+curtain_id+'"> </div>');
}

TaskTree.prototype.loadTree = function (filename) {
  var thisTree = this;

  var loadTreeCallReq = new ROSLIB.ServiceRequest({ task_file_name : filename });
  
  var success = this.server.loadTree.callService(loadTreeCallReq, function (result) {
    if (result.success === false) {
      alertify.error("Load aborted: could not load desired tree ("+filename+") from Task Hierarchy Server");
      return false;
    }
		console.log("Receivd task: " + result.serialized_task);
    thisTree.head = Node.unserializeJSON(result.serialized_task);
    alertify.success("New Task Loaded from ("+filename+")");

		// TODO: Traverse tree looking for primitives not present in the server primitives already, and add them to Primitives Toolbox

    thisTree.drawTree(thisTree.screen);
    return true;
  });
 
}





/**
 * Called prior to tree being rendered
 */
TaskTree.prototype.initTree = function() {
	// elements necessary for drawing, have to deal with IDs 
	
	this.editModes = new Object();
  this.editModes.addDependency = false;
	
	this.dragVariables = new Object();
  this.dragVariables.draggableFromPrimitivesToolbar = false;
  this.dragVariables.addingNode = null;
  this.dragVariables.nodeToAdd = null;
}


/**
 * For all children of 'parentNode': 
 *  If add===true, Add "prereqNode" to the prereqs lists.
 *  else remove prereqNode from prereqs lists
 */
TaskTree.prototype.modifySubtreePrereq = function(parentNode, prereqNode, params) {
  var unique = true;
  if (typeof params.unique != 'undefined')
    unique = !arrayContains(parentNode.prereqs, prereqNode);
  
  var operation = "none";
  if (typeof params.add != 'undefined')
    operation = "add";
  if (typeof params.remove != 'undefined')
    operation = "remove";

  if (parentNode.children.length == 0) {
    if (operation == 'add' && unique) // if going to add prereqNode to the node prereqs
      parentNode.prereqs.push(prereqNode); 
    else if (operation == 'remove') { // if going to remove prereqNode from the node prereqs
      parentNode.prereqs = jQuery.grep(parentNode.prereqs, function (value) {
        return value != prereqNode; 
      });
    } else {
      alertify.error("Invalid operation mode: " + operation + " in modifySubtreePrereq.");
    }
  }
  for (var i = 0; i < parentNode.children.length; i++){
    this.modifySubtreePrereq(parentNode.children[i], prereqNode, add); 
  }
}

TaskTree.prototype.addPrereqToChildren = function(parentNode, prereqNode) {
  this.modifySubtreePrereq(parentNode,prereqNode,{ add:true });
}

TaskTree.prototype.removePrereqFromChildren = function(parentNode, prereqNode) {
  this.modifySubtreePrereq(parentNode,prereqNode,{ remove:true });
}


// All elements inside 'screen' have thisTree.prefixID as an element ID prefix
TaskTree.prototype.drawTree = function(screen) { 
	//$(screen).css('position', 'relative'); 
	//$(screen).css('min-width', 5)
  var thisTree = this;
  this.screen = screen;

	this.initTree(); // initializes values. 
  if (typeof this.head != 'undefined') {
  	this.head.getNodeTools(); // updates tools for all nodes
  	this.head.isNodeCompleted(); // updates complete status for all nodes
  	this.head.getTimeNode(); // updates times for all nodes 
  	this.getActiveTools(this.head); // for tree structure. 
    this.head.findRenderWidth(this.taskWidth, this.head); 
    this.head.getNodePrereqs(); // factor up all the prereqs for all the nodes
  }

  $(screen).html('');


	$(screen).append("<div class='mainTaskBox level0' id='" + this.prefix + "'> </div>");

	$(this.prefixID + '.mainTaskBox').css('width', this.head.renderWidth); 
	// adds the main task and centers everything.  
	$(this.prefixID + '.mainTaskBox').append('<div class="mainTask" id="' + this.containerId + '"> </div>');
	centerWidth(this.prefixID + ".mainTaskBox", ".mainTask");
	$(this.prefixID + ' .mainTask').append('<div class = "mainBox"> </div>'); 
	centerWidth("#"+this.containerId, ".mainBox"); 
	$(this.prefixID +' .mainBox').append(this.head.name); 

  
  //TODO: Add popInfo box for tree root (mainBox) so user can toggle between clique and chain

  
	var finished = this.head.isNodeCompleted();
	
  // adds the box line under the tree root
  if (this.head.children.length > 0) {
		$(this.prefixID + ' .mainTask').append('<div class="boxLine"> </div>'); 
		centerWidth(this.prefixID + " .mainTask", ".boxLine"); 
	}


	if (this.editMode) {
    // Add the primitives toolbar allowing for drag/drop tree editing
		if ($('#'+this.primitiveBarId).length == 0) {
			$(screen).append('<div id="'+this.primitiveBarId+'" class="primBar shadow"> </div>');
			$('#'+this.primitiveBarId).draggable(); 
			$('#'+this.primitiveBarId).append('<b> <div class="primBarTitle"> Primitives </div> </b>');
			$('#'+this.primitiveBarId).append('<div class="primBarTaskBox"> </div>'); 
			$('#'+this.primitiveBarId+' .primBarTitle').dblclick(function(e) {
				$('#'+thisTree.primitiveBarId+' .primBarTaskBox').slideToggle(500); 
			});
			this.makePrimitives(this.primitives, screen); 
		} 
		
		// Move the rendered tree over so the primitives toolbar doesn't overlap
		$(screen).css('padding-left', $('#'+this.primitiveBarId).width() + 15); 	
    
    var exitDependencyEditorButton = $('<div class="exitEditorButton">Done</div>'); 
		$(screen).append(exitDependencyEditorButton); 
    $(exitDependencyEditorButton).click(function(e){
			thisTree.editModes.addDependency = false; 
			thisTree.dragVariables.addingNode = null; 
			$(this).fadeOut();  
			$('.textBlock').animate({opacity:1}); 
		});

		$(screen).css('min-height', $('#'+this.primitiveBarId).height() + 30);
		// makes the region for edit mode
		var hoverMain = $('<div class="hoverMain"></div>');
		$(screen + ' .mainTask').append(hoverMain);
		var editMain = $('<div class="editMain"></div>');

		// Edits the root tree node (Task Title)
		editMain.droppable({
			accept: ".primitive, .textBlock",
			drop: function(event, ui) {
				var nodeToAdd = new Node(thisTree.dragVariables.nodeToAdd);
				nodeToAdd.assignNewUID(); 
        thisTree.head.children.splice(0,0,nodeToAdd);
        
        // If dropped object was not from the toolbar, delete the dragged node from elsewhere in the tree
        if (!thisTree.dragVariables.draggableFromPrimitivesToolbar) {
					deleteNode(thisTree.dragVariables.nodeToAdd, thisTree.head); 
				}  
				$(screen).empty(); 
				thisTree.drawTree(screen); 
			}, 
			over:function(event, ui) {
				$(hoverMain).show(); 
			}, 
			out:function(event, ui) {
				$(hoverMain).hide();
			}
		});			
		$('#'+thisTree.containerId).append(editMain);

		$('.mainBox').click(function(e){
			$(this).attr('contenteditable', true);
			e.stopPropagation(); 
		});
		$('.mainBox').blur(function(){
			$(this).attr('contenteditable', false);
			thisTree.head.name = $(this).html();  
		});

	}
	
	
  var treeEditorPanel = $('<div class="treeEditorPanel"></div>'); 
  $(screen).append(treeEditorPanel);
  var editorPanelHtml = '';
  
  if (this.editMode) {
    editorPanelHtml += '<div class="toggleEditModeButton">Exit Edit Mode</div>';
    editorPanelHtml += '<div class="saveTreeButton">Save Tree</div>';
    editorPanelHtml += '<div class="loadTreeButton">Load Tree</div>';
  } else {
    editorPanelHtml += '<div class="toggleEditModeButton">Edit Tree</div>';      
  }
  
  $(treeEditorPanel).append(editorPanelHtml);
  $(treeEditorPanel).find('.toggleEditModeButton').click( function (e) {
    thisTree.editMode = !thisTree.editMode;
    e.stopPropagation();
    thisTree.drawTree(thisTree.screen);
  });
  
  if (this.editMode) {
    $(treeEditorPanel).find('.saveTreeButton').click( function (e) { thisTree.showSaveDialog(); } );
    $(treeEditorPanel).find('.loadTreeButton').click( function (e) { thisTree.showLoader(); } );      
  }


	// makes the rest of the tasks. 
	this.makeTasks(this.head, 1, this.prefixID + ".mainTaskBox", this.containerId, screen); 
	
  // Offset the tree node popouts so they're centered underneath their respective node
  $(this.prefixID + ' .popout').css('margin-left', (-30) + "px"); 
	$(this.prefixID + ' .popout').css('margin-top', (-10) + "px"); 


	$(screen).click(function (e) {
		if (!thisTree.editModes.addDependency) {
      // If not adding dependencies to a task, hide all popouts and deselect any nodes
			$(screen + ' .popout').fadeOut();
			$(screen + ' .textBlock').removeClass('clicked'); 
			$(screen + ' .textBlock').removeClass('curClicked'); 
			$(screen + ' .textBlock').removeClass('compClicked'); 
			e.stopPropagation(); 
		}
  	});
  
    // Make UI drop zones effectively transparent to allow node selection by clicking them
  	$('.ui-droppable').click( function (event) { $(this).parent().find('.textBlock').click(); event.stopPropagation() } );
}

/**
 *  Populate the Primitives Toolbar with all available primitives (given by the server via 'primitives') to the primitive toolbar in
 *  'screen'
 */
TaskTree.prototype.makePrimitives = function(primitives, screen) {
  var thisTree = this;
	$.each(primitives, function(i, currentPrim) {
		var primitiveID = this.prefix + "_prim_" + i;
		//if ($('#'+primitiveID).length != 0) return; // Element already exists

		// adds task into the bar
		$('#'+thisTree.primitiveBarId+" .primBarTaskBox").append('<div id="' + primitiveID + '"></div>');

    $("#" + primitiveID).append(currentPrim.name);  
    if (currentPrim.isMetaNode())    
      $("#" + primitiveID).addClass("primitive parent");  
    else
      $("#" + primitiveID).addClass("primitive");  

		$("#" + primitiveID).draggable({
      helper: 'clone',
			opacity: 0.5,
			revert: true,
			start: function(event, ui) {
        thisTree.dragVariables.draggableFromPrimitivesToolbar = true; 
        thisTree.dragVariables.primitiveIndex = i; 
        thisTree.dragVariables.nodeToAdd = new Node(thisTree.primitives[thisTree.dragVariables.primitiveIndex]);
				thisTree.dragVariables.nodeToAdd.assignNewUID();
				$(this).css('z-index', 5); // set node to display in front of everything while dragging
			},
			stop: function(event, ui) {
				$(this).css('z-index', 0); // Return to standard page visibility ordering
			}
		});
	});
}

/**
 * Updates the TaskTree.activeTools array by aggregating all tools from active tree nodes.
 */
TaskTree.prototype.getActiveTools = function (node) {
	// for each node, check to see if it matches the current node, 
	// and if so, add it's tools onto the current Tools list. 
	for (var i = 0; i < this.activeNodes.length; i++) { 
		if (node.uid == this.activeNodes[i]) { 
			for (var j = 0; j < node.tools.length; j++) {
				if (!arrayContains(node.tools[j], this.activeTools)) { // if not already there. 
					this.activeTools.push(node.tools[j]); 
        }
      }
		}
	} 
	for (var i = 0; i < node.children.length; i++) { // recursive call for all children
		this.getActiveTools(node.children[i]); 
	}
}

TaskTree.prototype.dependencyAnimations = function(currentUID, activePrereqs, node) {
	var currentTask = "#" + this.prefix + '_taskbox_' + node.uid + " .textBlock";
	var result = true; 
	if (node == this.head){
		result = false; 
	}
	if (node.uid == currentUID) { // get rid of selected status if current task 
		$(currentTask).removeClass('clicked'); 
		result = false; 
	} else if (node.children.length == 0) { // if leaf node 
		if (!arrayContains(activePrereqs, node)) { // If node isn't already in the activePrereqs list
			$(currentTask).animate({opacity:0.5}, function() {
				$(this).removeClass('clicked'); 
			}); 
			result = false; 
		}	else { // Node is in the activePrereqs list
			$(currentTask).addClass('clicked'); 
			$(currentTask).animate({opacity:1}); 
		}
	} else { // if a parent, add animations for all of its children
		for (var i = 0; i < node.children.length; i++) { 
			if (!this.dependencyAnimations(currentUID, activePrereqs, node.children[i]) && (node != this.head)) {
				result = false; 
				$("#" + this.prefix + '_taskbox_' + node.uid + " .textBlock").animate({opacity:0.5});
			}
		}
		if (result) {
			$("#" + this.prefix + '_taskbox_' + node.uid + " .textBlock").animate({opacity:1});
		}
	}
	return result; 
}

/**
 * Draw all tree nodes
 * @node Current head of subtree being rendered
 * @depth Tree level being rendered
 * @box Parent rendering container to place new child boxes within
 * @parentID taskbox ID of parent node
 * @screen rendering container for entire tree
 */
TaskTree.prototype.makeTasks = function (node, depth, box, parentID, screen) {
	var thisTree = this;   
	var level = "level" + depth; // ie "level1"  or "level2"... etc
	var levelClass = "#" + thisTree.prefixID + " .level" + depth; // the class level .level1 etc 
	width = $(box).width(); 

	// loops through to print out all the children
	$.each(node.children, function(i, currentChild){

  // Create the actual container(s) for the child node--
  //  childbox contains the entire subtree rooted at currentChild
  //  taskbox contains the entire currentChild node box

    var childbox_id =  thisTree.prefix + '_childbox_' + currentChild.uid;
    var taskbox_id = thisTree.prefix + '_taskbox_' + currentChild.uid;
    var textblock_id = thisTree.prefix + '_textBlock_' + currentChild.uid;
    
    var childbox = $('<div class="childBox ' + level + '" id="' + childbox_id + '"></div>');
    $(childbox).css('width', currentChild.renderWidth);
    $(box).append(childbox);

    // The taskbox container lives within the childbox container-- 
    //    taskbox == head node of the subtree, childbox == subtree
		$(childbox).append('<div class="task" id="' + taskbox_id +'"></div>'); 
		centerWidth('#'+childbox_id, ".task");

		// The top connecting line lives within the taskbox
		$('#'+taskbox_id).append('<div class="boxLine"> </div>');  
		centerWidth('#'+taskbox_id, ".boxLine"); 
		
    // textBlock class denotes the actual visible portion of the rendered node, containing its name
    $('#'+taskbox_id).append('<div id="'+textblock_id+'" class="textBlock"><div class="title">'+ currentChild.name +'</div></div>');  

    if (thisTree.editMode && currentChild.isMetaNode()) {
      $('#'+textblock_id + ' .title').click( function (e) { $(this).attr('contenteditable','true'); $(this).focus(); e.stopPropagation(); } );
      $('#'+textblock_id + ' .title').blur( function (e) { currentChild.name=$(this).text(); $(this).attr('contenteditable','false'); } );
    }
    
		// If currentChild is a metanode, add the parent class to visually distinguish it from skills
		if ((currentChild.children.length > 0) || (currentChild.skillType != "skill")) {
      $('#'+textblock_id).addClass('parent'); 
      $('#'+textblock_id).addClass(currentChild.skillType+"_node"); 
		} 
		
		// If currentChild is listed in the activeNodes list, render it accordingly with the 'current' class
		for (var j = 0; j < thisTree.activeNodes.length; j++) {
			if (currentChild.uid == thisTree.activeNodes[j]) {
		    $('#'+textblock_id).addClass('current'); 
			}
		}

		// If currentChild has been completed, render it with the 'complete' class to show it as such
		if (currentChild.isNodeCompleted()) {
		  $('#'+textblock_id).addClass('complete'); 
		}

		var popoutHTML = findPopoutInfo(currentChild); 

		// Add the information popout to the taskbox 
		$("#" + taskbox_id).append('<div class="popout"><div class="triangle"> </div><div class="popInfo">' + popoutHTML + ' </div></div>'); 


    // While in "Edit Mode", expose controls to allow for node deletion and dependency modification
		if (thisTree.editMode === true) {
			var dependencyButton = $("<div class='dependencyButton'>Add Dependencies</div>"); 
			var deleteButton = $("<div class='deleteButton'>Delete Node</div>");
      
      if (currentChild.isMetaNode()) {
        var metanodeTypeButton = $('<div class="metanode_type_switch"></div>');
        
        var cliqueClass = (currentChild.skillType == 'clique') ? ' metanode_switch_on' : '';
        var cliqueId = thisTree.prefix + "_metanode_button_" + currentChild.uid + "clique";
        var chainId = thisTree.prefix + "_metanode_button_" + currentChild.uid + "chain";
        var chainClass =  (currentChild.skillType == 'chain')  ? ' metanode_switch_on' : '';
        
        var cliqueButton = $("<div class='metanode_switch"+cliqueClass+"' id='"+cliqueId+"'>Clique</div>");
        var chainButton = $("<div class='metanode_switch"+chainClass+"' id='"+chainId+"'>Chain</div>");
        
        $(cliqueButton).click( function (e) {
          currentChild.skillType="clique";
          thisTree.drawTree(screen);
        });

        $(chainButton).click( function (e) {
          currentChild.skillType="chain";
          thisTree.drawTree(screen);
        });
        
        $(metanodeTypeButton).append(cliqueButton);
        $(metanodeTypeButton).append(chainButton);
        $('#' + taskbox_id + ' .popInfo').append(metanodeTypeButton);
      }
      
			$('#' + taskbox_id + ' .popInfo').append(dependencyButton);
			$('#' + taskbox_id + ' .popInfo').append(deleteButton);
			     
			deleteButton.click(function(e) {
				node.children.splice(i, 1); // remove selected node
				e.stopPropagation;
				thisTree.editModes.addDependency = false; // Exit dependency editor -- shouldn't be on at this point anyway
				$(screen).empty(); 
				thisTree.drawTree(screen); 
			}); 

			dependencyButton.click(function(e) {
				thisTree.editModes.addDependency = true; 
				thisTree.dragVariables.addingNode = currentChild; 
				$('.popout').fadeOut(); 
				$('.exitEditorButton').show();
				$('.exitEditorButton').animate({opacity:1}); 
				thisTree.dependencyAnimations(currentChild.uid, currentChild.getNodePrereqs(), thisTree.head);
				e.stopPropagation();
			});
		} else { 
      var completedButton = null;
      if (currentChild.isNodeCompleted())
        completedButton = $("<div class='completedButton'>Mark as Incomplete</div>"); 
      else
        completedButton = $("<div class='completedButton'>Mark as Completed</div>"); 
     
      $('#' + taskbox_id + ' .popInfo').append(completedButton);
      
      // Toggle 'completed' status
      $(completedButton).click(function(e) {
        currentChild.setCompleted(!currentChild.isNodeCompleted());
        thisTree.drawTree(screen);
      });
      
      // Only shows eligible subtasks based on current overall task progress
			// detects if task should be faded based on tool availability. 
			for (var j = 0; j < currentChild.tools.length; j++) {
				for (var k = 0; k < thisTree.activeTools.length; k++){
					
          // For the current node:
					//    if a required tool is currently in use, but the given box is not a parent, 
					//    is not already complete, and is not actively being performed: Fade out
					if ((currentChild.tools[j] == thisTree.activeTools[k]) &&
						(!$("#" + textblock_id).hasClass('parent')) &&
						(!$("#" + textblock_id).hasClass('complete')) &&
						(!$("#" + textblock_id).hasClass('current'))) {						
						$("#" + textblock_id).fadeTo('fast', 0.5); 
					}
				}

			}

			// Checks to see if the current node has its prerequisite skills fulfilled:
			//      Fades out if it is ineligible for completion
			currentChild.getNodePrereqs();
			for (var j = 0; j < currentChild.prereqs.length; j++) {
				if ((currentChild.prereqs[j].completed == false )
					&& !$("#" + textblock_id).hasClass('parent') &&
					!$("#" + textblock_id).hasClass('complete')) {
					$("#" + textblock_id).fadeTo('fast', 0.5); 
				}
			}
		}

		// if in Edit Mode, render the drop zones so the tree can be modified via drag-and-drop
		if (thisTree.editMode) { 

			var editLeft = $('<div class = "editLeft"> </div>'); // edit left obj
			var editRight = $('<div class = "editRight"> </div>'); // edit right obj
			var editBottomR = $('<div class = "editBottomR"> </div>'); // edit bottom obj
			var editBottomL = $('<div class = "editBottomL"> </div>'); // edit bottom obj
			var editBottom = $('<div class = "editBottom"> </div>'); // edit bottom obj
	
			var hoverLeft = $('<div class="hoverLeft"> </div>'); 
			var hoverRight = $('<div class="hoverRight"> </div>');
			var hoverBottomR = $('<div class="hoverBottomR"> </div>'); 
			var hoverBottomL = $('<div class="hoverBottomL"> </div>'); 
			var hoverBottom = $('<div class = "hoverBottom"> </div>'); 
			$('#'+ taskbox_id).append(hoverLeft);
			$('#'+ taskbox_id).append(hoverRight);
			
			if (currentChild.isMetaNode()) {
				$('#' + taskbox_id).append(hoverBottom); 
			}
			else if (currentChild.children.length == 0) {
				$('#' + taskbox_id).append(hoverBottomL);
				$('#' + taskbox_id).append(hoverBottomR);
			}
				
			// Left Drop Zone -- Add node 
			editLeft.droppable({
				accept: ".primitive, .textBlock",
				drop: function(event, ui) {
					var nodeToAdd = new Node(thisTree.dragVariables.nodeToAdd);   
          node.children.splice(i,0,nodeToAdd);
/*					for (var j = node.children.length; j >= i; j--) {
						node.children[j] = node.children[j-1]; 
					}
					node.children[i] = nodeToAdd;*/
					if (!thisTree.dragVariables.draggableFromPrimitivesToolbar) {
						deleteNode(thisTree.dragVariables.nodeToAdd, thisTree.head);  // Delete the dropped node from its original position
					}  
					$(screen).empty(); 
					thisTree.drawTree(screen); 
				},
				over:function(event, ui) {
					$(hoverLeft).show(); 
				},
				out:function(event, ui) {
					$(hoverLeft).hide();
				}
			});			

			// Edits the right
			editRight.droppable({
				accept: ".primitive, .textBlock",
				drop: function(event, ui) {
					var nodeToAdd = new Node(thisTree.dragVariables.nodeToAdd);   
/*					for (var j = node.children.length; j > i; j--) {
						node.children[j] = node.children[j-1]; 
					}
					node.children[i+1] = nodeToAdd; */
          node.children.splice(i+1,0,nodeToAdd);
					if (!thisTree.draggableFromPrimitivesToolbar) {
						deleteNode(thisTree.dragVariables.nodeToAdd, thisTree.head);  // Delete the dropped node from its original position
					}
					$(screen).empty(); 
					thisTree.drawTree(screen); 					
				},
				over:function(event, ui) {
					$(hoverRight).show(); 
				},
				out:function(event, ui) {
					$(hoverRight).hide(); 
				}
			});
			
			// Edits the bottom Right
			editBottomR.droppable({
				accept: ".primitive, .textBlock",
				drop: function(event, ui) {
					var nodeToAdd = new Node(thisTree.dragVariables.nodeToAdd);   
					var x = new Node("Clique");
          x.skillType = "clique";
					x.children[0] = nodeToAdd; 
					x.children[1] = node.children[i]; 
					node.children[i] = x; 
					if (!thisTree.dragVariables.draggableFromPrimitivesToolbar) {
						deleteNode(thisTree.dragVariables.nodeToAdd, thisTree.head);  // Delete the dropped node from its original position
					}'#' + taskbox_id + ' .textBlock'
					$(screen).empty(); 
					thisTree.drawTree(screen);  
				},
				over:function(event, ui) {
					$(hoverBottomR).show(); 
				},
				out:function(event, ui) {
					$(hoverBottomR).hide();
				}
			});	

			// Edits the bottom Left
			editBottomL.droppable({
				accept: ".primitive, .textBlock", 
				drop: function(event, ui) {
					var nodeToAdd = new Node(thisTree.dragVariables.nodeToAdd);   
					var x = new Node("Clique");
          x.skillType = "clique";
          x.children[0] = node.children[i]; 
          x.children[1] = nodeToAdd;  
					node.children[i] = x; 
					if (!thisTree.dragVariables.draggableFromPrimitivesToolbar) {
						deleteNode(thisTree.dragVariables.nodeToAdd, thisTree.head);  // Delete the dropped node from its original position
					}
					$(screen).empty(); 
					thisTree.drawTree(screen);  
				},
				over:function(event, ui) {
					$(hoverBottomL).show(); 
				}, 
				out:function(event, ui) {
					$(hoverBottomL).hide();
				}
			});
	
      // Bottom drop-zone is reserved for the top-level tree root, adding the dropped node to the left of the first tree level
			editBottom.droppable({
				accept:".primitive, .textBlock", 
				drop: function(event, ui) {
					var nodeToAdd = new Node(thisTree.dragVariables.nodeToAdd);   
/*
					for (var j = node.children[i].children.length; j > 0; j--) {
						node.children[i].children[j] = node.children[i].children[j-1]; 
					}
					node.children[i].children[0] = nodeToAdd; 
*/
          node.children[i].children.splice(0,0,nodeToAdd);
					if (!thisTree.dragVariables.draggableFromPrimitivesToolbar) {
						deleteNode(thisTree.dragVariables.nodeToAdd, thisTree.head);  // Delete the dropped node from its original position
					}  
					$(screen).empty(); 
					thisTree.drawTree(screen);  
				}, 
				over:function(event, ui) {
					$(hoverBottom).show(); 
				},
				out:function(event, ui) {
					$(hoverBottom).hide();
				}
			});	

			$('#' + taskbox_id).append(editLeft);
			$('#' + taskbox_id).append(editRight);
			if (currentChild.isMetaNode()) {
				$('#' + taskbox_id).append(editBottom); 
			}	else if (currentChild.children.length == 0) {
				$('#' + taskbox_id).append(editBottomR);
				$('#' + taskbox_id).append(editBottomL);
			}
			
			/*var toDrag = $('#'+taskbox_id).parent();//.parent(); 
			//$('#'+taskbox_id).parent().parent(); 
			$(toDrag).draggable({
				handle: ".textBlock", 
				revert: "invalid"
			});*/

			$('#' + textblock_id).draggable({
				revert: "invalid",  
				start: function (event, ui) {  // get rid of the tasks edit boxes
					thisTree.dragVariables.draggableFromPrimitivesToolbar = false; 
					thisTree.dragVariables.nodeToAdd = node.children[i]; 
					$(this).css('z-index', 5); 
          $(childbox).find('.editBottomR').hide(); 
          $(childbox).find('.editBottomL').hide();
          $(childbox).find('.editBottom').hide();
          $(childbox).find('.editRight').hide();
          $(childbox).find('.editLeft').hide();
				}, 
				stop: function (event, ui) { // on end drag, show the tasks edit boxes
          $(childbox).find('.editBottomR').hide(); 
          $(childbox).find('.editBottomL').hide();
          $(childbox).find('.editBottom').hide();
          $(childbox).find('.editRight').hide();
          $(childbox).find('.editLeft').hide();
					$(this).css('z-index', 0); 
				},
				opacity: 0.5 // opacity down during drag. 
			});

			// if rendering a parent node, allow its text/label to be edited
      /*
			if ((currentChild.children.length > 0) || currentChild.isMetaNode()){ // if in edit mode allow title to be changed 
				$('#' + taskbox_id + ' .title').click(function(e){
					$(this).attr('contenteditable', true); 					
					e.stopPropagation(); 
				});
				$('#' + taskbox_id + ' .title').blur(function(){
					$(this).attr('contenteditable', false);
					currentChild.name = $(this).html();  
				})
			}
			*/

		}
		
	$("#" + taskbox_id + ' .textBlock').click(function(e) {
    
    // If in the dependency editor, add the clicked node to the list of dependencies for "dragVariables.addingNode"
		if (thisTree.editModes.addDependency) {
			if (currentChild != thisTree.dragVariables.addingNode) { // don't add the node that you're adding dependencies to 
					if ($("#" + taskbox_id + ' .textBlock').css('opacity') == '1') {
						thisTree.modifySubtreePrereq(thisTree.dragVariables.addingNode, currentChild, { remove:true });
						thisTree.head.getNodePrereqs(); 
						thisTree.dependencyAnimations(thisTree.dragVariables.addingNode.uid, thisTree.dragVariables.addingNode.prereqs, thisTree.head); 
					} else {
						thisTree.modifySubtreePrereq(thisTree.dragVariables.addingNode, currentChild, {add:true});
						thisTree.head.getNodePrereqs(); 
						thisTree.dependencyAnimations(thisTree.dragVariables.addingNode.uid, thisTree.dragVariables.addingNode.prereqs, thisTree.head);   
					}
			}
		} else {
      // Not in the dependency editor: display the popout associated with the clicked node.
			$(' .popout').not($(this).parent().children('.popout')).fadeOut();
			$(' .textBlock').not(this).removeClass('clicked'); 
			$(' .textBlock').not(this).removeClass('curClicked'); 
			$(' .textBlock').not(this).removeClass('compClicked'); 
			
			$(this).parent().children(".popout").fadeToggle();  

	 		if ($(this).hasClass('parent')) {
        
      }	else if ($(this).hasClass('current')){ // if current, 
	 			$(this).toggleClass('curClicked'); 
	 		}	else if ($(this).hasClass('complete')) {
				$(this).toggleClass('compClicked'); 
			}	else { // if not a parent (ie all other primitives)
	 			$(this).toggleClass('clicked'); 
	 		}
	 	}
   		e.stopPropagation();
	});
	

		// draw connecting line 
		var div1 = $('#'+parentID).get(0); 
		var div2 = $('#'+taskbox_id).get(0); 
    
 	 	thisTree.connect(div1, div2, $('#'+parentID).parent());

		// if the current node has children, go down recursively to print them. 
		if (currentChild.children.length > 0) {
			$('#' + taskbox_id).append('<div class = "boxLine"> </div>'); 
			centerWidth('#' + taskbox_id, ".boxLine"); 		
			thisTree.makeTasks(currentChild, depth+1, '#' + childbox_id, taskbox_id,screen);		
		}
	});
}

// connects the bottom center of div1 to the top center of div2. 
TaskTree.prototype.connect = function (div1, div2, box) {
    var off1 = getOffset(div1);
    var off2 = getOffset(div2);
    var parentOff = getOffset(this.prefixID); 
    // bottom middle
    var x1 = off1.left + off1.width/2;
    var y1 = off1.top + off1.height;
    // top middle
    var x2 = off2.left + off2.width/2 ;
    var y2 = off2.top ;
    // distance
    var length = Math.sqrt(((x2-x1) * (x2-x1)) + ((y2-y1) * (y2-y1)));
    // center
    var cx = ((x1 + x2) / 2) - (length / 2);

    // takes the width of boxLine and makes it the width of the connectors
    thickness = parseInt($('.boxLine').css('width'), 10) ; // converts to int 
    var cy = ((y1 + y2) / 2) - (thickness / 2);
    
    // angle
    var angle = Math.atan2((y1-y2),(x1-x2))*(180/Math.PI);

    var htmlLine = "<div class = 'connectLine' style='height:" + $('.boxLine').css('width') + ";position:absolute; left:" + cx + "px; top:" + cy + "px; width:" + length + "px; -moz-transform:rotate(" + angle + "deg); -webkit-transform:rotate(" + angle + "deg); -o-transform:rotate(" + angle + "deg); -ms-transform:rotate(" + angle + "deg); transform:rotate(" + angle + "deg);' />";
    
    // add the html line into the html body. 
    $(box).append(htmlLine);
}

// returns true if the given element is not in the array 
function arrayContains(array, element) { 
	for (var i = 0; i < array.length; i++) {
		if (array[i] == element) {
			return true;
		}
	}
	return false; 
} 

// finds the info necessary for the popout 
var findPopoutInfo = function(node) {
	// initial variables
	var hours = Math.floor(node.time/(3600)); 
	var minutes = Math.floor((node.time - hours*3600)/60); 
	var seconds = node.time - hours*3600 - minutes*60; 
	
	// creates the time needed line
	var timeHTML = "<div><b>Time Needed</b>: "
	if (hours > 0) { // number of hours
		if (hours == 1){
			timeHTML += hours + " hour ";
		}
		else {
			timeHTML += hours + " hours "; 
		}
	}
	if (minutes > 0) { // number of minutes
		if (minutes == 1) {
			timeHTML += minutes + " minute "; 
		}
		else {
			timeHTML += minutes + " minutes "; 
		}
	}
	if (seconds == 1) { // number of hours
		timeHTML += seconds + " second"; 
	}
	else {
		timeHTML += seconds + " seconds"; 
	}
	timeHTML += "</div>";

	// creates the line for tools
	var toolsHTML = "<div><b>Tools Needed</b>: ";
	if (node.tools.length == 0) { // if no tools needed
		toolsHTML += "None"; 
	}
	else { // for proper syntax
		for (var i = 0; i < node.tools.length; i++) {
			if ((node.tools.length - (i+1)) > 1) {
				toolsHTML += node.tools[i] + ", "; 
			}
			else if ((node.tools.length - (i+1))  == 1) {
				toolsHTML += node.tools[i] + " and "; 
		}	
			else {
				toolsHTML += node.tools[i] + " "; 
			}
		}
	}
	toolsHTML += "</div>";

	var prereqsHTML = "<div><b>Prerequisite Tasks: </b>"; 
	if (node.prereqs.length == 0) {
		prereqsHTML += "None"; 
	}
	else {
		for (var i = 0; i < node.prereqs.length; i++) {
			if ((node.prereqs.length - (i+1)) > 1) {
				prereqsHTML += node.prereqs[i].name + ", ";
			}
			else if ((node.prereqs.length - (i+1)) == 1) {
				prereqsHTML += node.prereqs[i].name + " and "; 
			}
			else {
				prereqsHTML += node.prereqs[i].name + " "; 
			}
		} 
	}
	prereqsHTML += "</div>";

    
	
	
	var retHtml = timeHTML + toolsHTML + prereqsHTML; 
  return retHtml;
}

// gets the coordinates of the element. 
function getOffset( el ) {
    var _x = 0;
    var _y = 0;
    var _w = el.offsetWidth|0;
    var _h = el.offsetHeight|0;
    while( el && !isNaN( el.offsetLeft ) && !isNaN( el.offsetTop ) ) {
        _x += el.offsetLeft - el.scrollLeft;
        _y += el.offsetTop - el.scrollTop;
        el = $(this.prefixID).offsetParent;
    }
    return { top: _y, left: _x, width: _w, height: _h };
} 

// center the given element in the given box. 
function centerWidth(box , element) { 

	// max of 0 (element width > box width) or the pixels needed to add to center element
	var pixelsAdded = Math.max(0, (($(box).width()/2) - ($(element).width()/2)));
	$(box + " " + element).css("margin-left", pixelsAdded); 
	$(box + " " + element).css("margin-right", pixelsAdded-1); 
}



/**
 * Performs depth-first tree traversal from head looking for instances of target. Removes first
 * target found in each branch of the searched tree
 */ 
function deleteNode (target, head) { // always passed head first, so don't need to check actual node. 
	for (var i = 0; i < head.children.length; i++) {
		if (head.children[i] == target) {
      head.children.splice(i,1);
      return;
		} else {
			deleteNode(target, head.children[i]); 
		}
	}
}

