import copy
import networkx as nx
import dill as pickle
import json

# Clique Chain Hierarchical Task Network
class CCHTN(object):

  def __init__(self, activity_uid, activity_name=None):
    if activity_name is None: activity_name = activity_uid

    self._graph_type = nx.DiGraph # Use directed graph class from NetworkX Package
    self._graph = self._graph_type()
    #self._attributes = {'initiation_nodes': [], 'termination_nodes': [], 'preconditions': [], 'type': 'chain'}

    # Type: 'chain', 'clique', 'skill'

    # Subgraphs are mapped as follows:
    # self._graph.node[node_str]['subgraph'] = {'graph': self._graph_type(), 'metanode_type': 'chain', 'initiation_nodes': [], 'termination_nodes': []}

    # Nodes have precondition restrictions in the form of lists of nodes that must be 'completed':
    # self._graph.node[node_str]['preconditions']

    #self._graph.add_node(activity_name, parent=None, metanode_type='chain', initiation_nodes=[], termination_nodes=[])
    self._root_uid = activity_uid
    self._root_name = activity_name
    self._default_graph_attrs = {'initiation_nodes': [], 'termination_nodes': [], 'child_ordering': []}

    self.add_activity(activity_uid, None, data={'uid': activity_uid, 'skill': activity_name})

  '''
  Saving / Loading / Serialization functions
  '''
  def save(self, filename):
    f = open(filename, 'wb')
    pickle.dump(self, f)
    f.close()

  @staticmethod
  def load(filename):
    f = open(filename, 'rb')
    cchtn = pickle.load(f)
    f.close()
    return cchtn

  @staticmethod
  def from_JSON(json_string):
    obj = json.loads(json_string) # Should be a JSONified head node from the task hierarchy

    htn = CCHTN(obj['uid'], obj['skill'])

    def traverse_tree(cur_json_node, parent_htn_node, htn):
      child_ids = []
      for child in cur_json_node['children']:
        child_ids.append(child['uid'])

      if parent_htn_node is not None:
        cur_htn_node = htn.add_activity_to_node(cur_json_node['uid'], parent_htn_node, data=cur_json_node)
      else:
        cur_htn_node = htn.get_node(cur_json_node['uid'])

      if cur_htn_node is None: raise Exception("cur_htn_node is None -- couldn't find %s in graph." % cur_json_node['uid'])

      if cur_json_node['skillType'] == 'clique':
        print "Adding children to %s: %s" % (str(cur_htn_node['uid']), str(child_ids))
        htn.add_clique(child_ids, cur_htn_node, data=cur_json_node['children'])
      elif cur_json_node['skillType'] == 'chain':
        print "Adding children to %s: %s" % (str(cur_htn_node['uid']), str(child_ids))
        htn.add_chain(child_ids, cur_htn_node, data=cur_json_node['children'])
      elif cur_json_node['skillType'] != 'skill':
        print "Error -- Invalid node type %s." % (str(cur_json_node['skillType']))

      for child in cur_json_node['children']:
        traverse_tree(child, cur_htn_node, htn)

    traverse_tree(obj, None, htn)
    return htn


  def to_JSON(self):
    root_node = self.get_root_node()
    '''
    Example Node:

    children:Array[3]
    completed:false
    name:"Make Salad"
    prereqs:Array[0]
    renderWidth:1400
    skillType:"chain"
    time:505
    tools: Array[7]
    uid: "node_UID_Make-Salad_8891"
    '''

    json_htn = {}
    def traverse_tree(root_node):
      node = {}
      node.update(root_node) # Take all keys from root_node
      if 'graph' in node: del node['graph'] # Remove subgraph, since it will be added as 'children'
      if 'child_ordering' in node: del node['child_ordering'] # Remove subgraph, since it will be added as 'children'

      node['children'] = []

      if node['skillType'] == 'chain' or node['skillType'] == 'clique':
        child_graph = root_node['graph']
        children = []
        child_node_order = []

        if 'child_ordering' in root_node:
          child_node_order = root_node['child_ordering']
        else:
          child_node_order = [node_name for node_name in child_graph.node]

        for child_node_id in child_node_order:
          children.append(traverse_tree(child_graph.node[child_node_id]))
        node['children'] = children

      return node

    json_htn = traverse_tree(root_node)
    return json.dumps(json_htn)

  '''
  Progress tracking (Subtask completion) functions
  '''

  def get_completion_status(self, activity_uid, head_node=None):
    ''' Returns completion status of the given node. If activity_node is a metanode, return complete only if all sub-nodes are complete.
    '''
    if head_node is None: head_node = self.get_root_node()
    return CCHTN.get_graph_completion_status(activity_uid, head_node)



  def change_completion_status(self, activity_node_id=None, head_node=None, complete_status=True):
    '''
    Given an activity_node, change the status to complete_status
    @param activity_node Metanode from the DiGraph (dict) that contains a 'completed' field
    @param head_node Dict object containing head_node['graph'] DiGraph object that contains activity_node
    @param complete_status Value to set completed status to
    '''

    activity_node = self.get_node(activity_node_id, head_node)
    if activity_node is None: raise Exception('No node with id %s in graph.' % activity_node_id)

    def change_metanode_status(activity_node, complete_status):
      '''Recursively change completion status'''
      activity_node['completed'] = complete_status
      if CCHTN.is_metanode(activity_node):
        for sub_node_key in activity_node['graph'].node:
          change_metanode_status(activity_node['graph'].node[sub_node_key], complete_status)

    change_metanode_status(activity_node, complete_status)

  def mark_complete(self, activity_id, head_node=None):
    '''
      Adds completed status for activity_id and all its children within root_graph
    '''
    self.change_completion_status(activity_id, head_node, True)
    return

  def mark_incomplete(self, activity_id, head_node=None):
    '''
      Removes completion mark for activity_id and all its children within root_graph
    '''
    self.change_completion_status(activity_id, head_node, False)
    return

  def get_activity_status(self, activity_id=None, head_node=None):
    '''
    Returns all complete and incomplete activities within root_graph.
    '''
    activity_node = self.get_node(activity_id, head_node)
    activity_graph = CCHTN.get_subgraph(activity_node)
    if activity_graph is None:
      if activity_node['completed'] is True:
        return [activity_node], []
      else:
        return [], [activity_node]

    complete_activity_list = []
    incomplete_activity_list = []
    for node_name in activity_graph.node:
      if self.get_completion_status(node_name, activity_node) is not True:
        incomplete_activity_list.append(activity_graph.node[node_name])
      else:
        complete_activity_list.append(activity_graph.node[node_name])

      if self.is_metanode(activity_graph.node[node_name]):
        meta_complete, meta_incomplete = self.get_activity_status(node_name, activity_node)
        complete_activity_list.extend(meta_complete)
        incomplete_activity_list.extend(meta_incomplete)
    return complete_activity_list, incomplete_activity_list


  '''
  Graph/Subgraph manipulation functions
  '''
  def add_activity(self, new_activity_id, parent_activity_id=None, data={}):
    '''
    Add an activity with uid new_activity_id to root graph or node identified by parent_activity_id with attributes data
    '''
    parent_node = None
    if parent_activity_id is not None:
      parent_node = self.get_node(parent_activity_id)
      if parent_node is None: raise Exception('No activity with uid %s in graph to append a new activity within.' % parent_activity_id)

    self.add_activity_to_node(new_activity_id, parent_node, data)

  def add_activity_to_node(self, new_activity_id, parent_node, data={}):
    '''
    Add a new node (new_activity_id, data) to the graph in parent_node
    '''
    parent_graph = None
    parent_uid = None
    if parent_node is not None and CCHTN.is_metanode(parent_node) is False:
      parent_graph = self.add_subgraph_to_node(parent_node)
      parent_uid = parent_node['uid']
    elif parent_node is not None:
      parent_graph = parent_node['graph']
      parent_uid = parent_node['uid']
    elif parent_node is None:
      # Adding root node to graph
      if len(self._graph.nodes()) > 0: raise Exception("Adding more than one head node to root graph!")
      parent_graph = self._graph

    if parent_graph is None:
      raise Exception('Invalid graph provided as parent for new activity')

    parent_graph.add_node(new_activity_id, uid=new_activity_id, parent=parent_uid, skill=new_activity_id, completed=False, skillType='skill')
    parent_graph.node[new_activity_id].update(data)

    if 'children' in parent_graph.node[new_activity_id]: del parent_graph.node[new_activity_id]['children'] # Child data is stored within 'graph'.

    return parent_graph.node[new_activity_id]

  def get_root_node(self):
    '''Returns the root node of the graph'''
    return self._graph.node[self._root_uid]

  def add_subgraph(self, parent_activity_id, head_node=None):
    '''Add a subgraph to node with id parent_activity_id in graph contained within head_node.BaseException
       Returns the new subgraph object
    '''
    if head_node is None: head_node = self.get_root_node()
    parent_node = self.get_node(parent_activity_id, head_node)
    if parent_node is None:
      raise Exception('Could not find a node with activity name %s to attach a subgraph to.' % parent_activity_id)
    elif CCHTN.is_metanode(parent_node) is None:
      raise Exception('Attempt to add subgraph to node with existing subgraph!')

    return self.add_subgraph_to_node(parent_node)

  def add_subgraph_to_node(self, parent_node):
    '''Turns parent_node into a metanode, adding a subgraph'''
    parent_node['graph'] = self._graph_type()
    parent_node.update(self._default_graph_attrs)
    return parent_node['graph']


  def add_transition(self, activity_id_from, activity_id_to, metadata_dict={}, parent_graph=None):
    '''Adds an edge in parent_graph
    '''
    if parent_graph is None:
      raise Exception('Transition being added to non-existent graph')

    parent_graph.add_edge(activity_id_from, activity_id_to, copy.copy(metadata_dict))
    edge_data = parent_graph.get_edge_data(activity_id_from, activity_id_to)
    if 'prerequisites' not in edge_data:
      edge_data['prerequisites'] = []
    edge_data['prerequisites'].append(activity_id_from)

  @staticmethod
  def mark_initiation_nodes(initiation_node_ids, parent_node):
    '''Set initiation_nodes attribute on parent_node to the list of ids in initiation_node_ids'''
    return CCHTN._mark_nodes('initiation_nodes', initiation_node_ids, parent_node)

  @staticmethod
  def mark_termination_nodes(termination_node_ids, parent_node):
    '''Set termination_nodes attribute on parent_node to the list of ids in termination_node_ids'''
    return CCHTN._mark_nodes('termination_nodes', termination_node_ids, parent_node)

  @staticmethod
  def _mark_nodes(mark_type, node_ids, parent_node):
    '''Indicates nodes in the list (node_ids) as being initiation/termination (mark_type) nodes of (parent_node).
    '''
    if parent_node is None or CCHTN.is_metanode(parent_node) is False: raise Exception('Attempt to mark initiation nodes on non-existent graph')
    if mark_type not in parent_node: raise Exception('Attempt to mark nodes without proper attribute entry')

    for node_id in node_ids:
      if node_id not in parent_node['graph'].node:
        raise Exception('Node %s not part of subgraph %s.' % (node_id, parent_node['uid']))

      if node_id in parent_node[mark_type]: continue
      else: parent_node[mark_type].append(node_id)

    return

  def add_clique(self, activity_id_list, parent_node, data=None):
    '''
      Adds a fully connected set of activities (activity_id_list) to the empty subgraph indicated by parent_activity
      data contains a list of dict objects with metadata for each node in activity_id_list
    '''
    if parent_node is None: raise Exception('add_clique called without parent_node to turn into clique')
    parent_graph = CCHTN.get_subgraph(parent_node)

    if parent_graph is not None and parent_graph.number_of_nodes() > 0:
      raise Exception('Non-empty subgraph with id %s (%s) already exists -- cannot instantiate new clique.' \
                      % (str(parent_node['uid']), str(parent_node['skill'])))
    elif parent_graph is None:
      parent_graph = self.add_subgraph_to_node(parent_node)

    parent_node['skillType'] = 'clique'
    if 'child_ordering' in parent_node:
      del parent_node['child_ordering']

    if data is not None and len(data) == len(activity_id_list):
      for activity_id, activity_data in zip(activity_id_list, data):
        self.add_activity_to_node(activity_id, parent_node, activity_data)
    else:
      for activity_id in activity_id_list:
        self.add_activity_to_node(activity_id, parent_node)

    for i, activity_i in enumerate(activity_id_list):
      for j, activity_j in enumerate(activity_id_list):
        if i == j: continue
        parent_graph.add_edge(activity_i, activity_j)

    # Add node UID to all of its outbound edges
    for edge_from, edge_to in parent_graph.edges():
      edge_data = parent_graph.get_edge_data(edge_from, edge_to)
      if 'prerequisites' not in edge_data:
        edge_data['prerequisites'] = []
      edge_data['prerequisites'].append(edge_from) # Add own UID to outbound edge


    CCHTN.mark_initiation_nodes(activity_id_list, parent_node)
    CCHTN.mark_termination_nodes(activity_id_list, parent_node)
    return

  def add_chain(self, activity_id_list, parent_node, data=None):
    '''
      Adds a totally-ordered chain of activities (activity_id_list) to the empty subgraph parent_activity
      data contains a list of dict objects with metadata for each node in activity_id_list
    '''
    if parent_node is None: raise Exception('add_chain called without parent_node to turn into chain')

    parent_graph = CCHTN.get_subgraph(parent_node)

    if parent_graph is not None and parent_graph.number_of_nodes() > 0:
      raise Exception('Non-empty subgraph with name %s already exists -- cannot instantiate new chain.' % str(parent_node['uid']))
    elif parent_graph is None:
      parent_graph = self.add_subgraph_to_node(parent_node)

    parent_node['skillType'] = 'chain'
    parent_node['child_ordering'] = activity_id_list

    if data is not None and len(data) == len(activity_id_list):
      for activity_id, activity_data in zip(activity_id_list, data):
        self.add_activity_to_node(activity_id, parent_node, activity_data)
    else:
      for activity_id in activity_id_list:
        self.add_activity_to_node(activity_id, parent_node)

    parent_graph.add_path(activity_id_list)

    # Add node UID to all of its outbound edges
    for edge_from, edge_to in parent_graph.edges():
      edge_data = parent_graph.get_edge_data(edge_from, edge_to)
      if 'prerequisites' not in edge_data:
        edge_data['prerequisites'] = []
      edge_data['prerequisites'].append(edge_from) # Add own UID to outbound edge

    CCHTN.mark_initiation_nodes([activity_id_list[0]], parent_node)
    CCHTN.mark_termination_nodes([activity_id_list[-1]], parent_node)
    return

  def is_member(self, activity_uid, parent_node=None):
    '''Returns True if activity is in the graph'''
    return self.get_node(activity_uid, parent_node) is not None


  '''
  Information retrieval functions
  '''
  def get_node(self, node_uid, head_node=None):
    '''Returns the first node matching node_str_name stemming from head_node['graph']
    '''
    if head_node is None: head_node = self._graph.node[self._root_uid]
    return CCHTN.get_node_from_graph(node_uid, head_node)


  @staticmethod
  def get_flat_graph(head_node):
    ''' Returns a single flat graph with appropriate connections, recursively expanding metanodes.
        head_node indicates the level of the graph hierarchy to begin at.
    '''

    flat_graph = nx.DiGraph()
    graph_stack = [] # Stack of {dict} node objects, where node dict includes 'graph' attr (metanodes)
    graph_stack.append(head_node)

    flat_initiation_nodes = copy.copy(CCHTN.get_initiation_nodes(graph_stack[0]))
    flat_termination_nodes = copy.copy(CCHTN.get_termination_nodes(graph_stack[0]))
    flat_graph.add_node(graph_stack[0]['uid'], graph_stack[0])
    # While there are still graphs to expand, iterate through them, expanding them in-place
    while len(graph_stack) > 0:
      metanode = graph_stack.pop()
      graph_node_uid = metanode['uid']
      inner_graph = CCHTN.get_subgraph(metanode)

      in_edges = []
      out_edges = []

      if graph_node_uid is not head_node['uid']:
        in_edges = flat_graph.in_edges(graph_node_uid)
        out_edges = flat_graph.out_edges(graph_node_uid)

      # Add all nodes and associated metadata from inner_graph
      for node_uid in inner_graph.node:
        if node_uid in flat_graph.node: raise Exception('Node_uid %s already exists in inner_graph %s' % (node_uid, graph_node_uid))
        flat_graph.add_node(node_uid, copy.copy(inner_graph.node[node_uid]))
        if CCHTN.is_metanode(inner_graph.node[node_uid]): graph_stack.append(inner_graph.node[node_uid])

      # Add all inner_graph edges along with their metadata
      for edge_from, edge_to in inner_graph.edges():
        flat_graph.add_edge(edge_from, edge_to, copy.copy(inner_graph.get_edge_data(edge_from, edge_to)))

      # Add initiation edges: From all nodes with edges inbound to graph_node_uid, to each node in graph_node_uid's initiation set
      for edge_from, edge_to in in_edges:
        for node_uid in CCHTN.get_initiation_nodes(metanode):
          # Connect inbound edge to initiation node with metadata inbound to metanode
          flat_graph.add_edge(edge_from, node_uid, copy.copy(flat_graph.get_edge_data(edge_from, graph_node_uid)))

      # Add termination edges: From all nodes in termination set to out-edge destinations in original graph
      for edge_from, edge_to in out_edges:
        for node_uid in CCHTN.get_termination_nodes(metanode):
          # Connect outbound edge from termination nodes to other connections, with
          flat_graph.add_edge(node_uid, edge_to, copy.copy(flat_graph.get_edge_data(graph_node_uid, edge_to)))

      # Update all edge prerequisites to include only nodes in flat_graph
      for edge_from, edge_to in flat_graph.edges():
        edge_data = flat_graph.get_edge_data(edge_from, edge_to)
        if 'prerequisites' not in edge_data: continue
        if graph_node_uid in edge_data['prerequisites']:
          del edge_data['prerequisites'][edge_data['prerequisites'].index(graph_node_uid)]
          for node_uid in inner_graph.node: edge_data['prerequisites'].append(node_uid)

      # Update initiation and termination node sets to include only nodes in flat_graph
      if graph_node_uid in flat_initiation_nodes:
        flat_initiation_nodes.remove(graph_node_uid)
        flat_initiation_nodes.extend([node_uid for node_uid in CCHTN.get_initiation_nodes(metanode)])

      if graph_node_uid in flat_termination_nodes:
        flat_termination_nodes.remove(graph_node_uid)
        flat_termination_nodes.extend([node_uid for node_uid in CCHTN.get_termination_nodes(metanode)])

      # Remove metanode from flat_graph
      flat_graph.remove_node(graph_node_uid)

    flat_graph_head_node = {'uid': head_node['uid'], 'graph': flat_graph, 'initiation_nodes': flat_initiation_nodes, 
                            'termination_nodes': flat_termination_nodes}

    CCHTN.get_graph_completion_status(flat_graph_head_node)

    return flat_graph_head_node


  @staticmethod
  def get_future_primitive_activities(activity_uid, head_node, max_look_ahead=1, completed_node_uids=None):
    '''Flattens the head_node graph and calls CCHTN.get_future_activities on it
    '''
    flat_graph = CCHTN.get_flat_graph(head_node)

    return CCHTN.get_future_activities(activity_uid, flat_graph, max_look_ahead, completed_node_uids)

  @staticmethod
  def get_future_activities(activity_uid, head_node, max_look_ahead=1,\
          completed_node_uids=None):
    '''
    Returns a list of (steps_ahead, node) tuples up to max_look_ahead steps 
    into the future from activity_uid
    '''
    if activity_uid is None\
            and (completed_node_uids is None or len(completed_node_uids) == 0):
      ## Use initiation nodes to populate future_activities_list
      initiation_node_uids = CCHTN.get_initiation_nodes(head_node)
      future_activities_list = []
      for uid in initiation_node_uids:
        future_activities_list.append((1,\
                CCHTN.get_node_from_graph(uid,head_node)))
        next_activities = (CCHTN.get_future_activities(uid, head_node,\
                max_look_ahead-1, completed_node_uids))
        future_activities_list.extend\
                ([(a[0]+1, a[1]) for a in next_activities])
      future_activities_list = sorted(future_activities_list, key=lambda x: x[0])
      return future_activities_list

    cur_node = CCHTN.get_node_from_graph(activity_uid, head_node)
    open_list = [(cur_node, completed_node_uids)]
    future_activities_list = []

    look_ahead_steps = 1
    while look_ahead_steps <= max_look_ahead:
      next_open_list = []
      while len(open_list) > 0:
        node, completed_node_uids = open_list.pop()
        node_uid = node['uid'] if node is not None else None
        next_activities = CCHTN.get_graph_next_activities(node_uid,\
                head_node, completed_node_uids)
        new_completed_nodes = None
        if completed_node_uids is not None:
          new_completed_nodes = completed_node_uids + [node_uid]
        for activity_node in next_activities:
          next_open_list.append((activity_node, new_completed_nodes))
        for activity_node in next_activities:
          future_activities_list.append((look_ahead_steps, activity_node))
      open_list = next_open_list
      look_ahead_steps += 1

    return future_activities_list

  def get_next_activities_primitives(self, activity_uid, eligible_activities_only=False, head_node=None):
    '''Returns (node, parent) pairs for all 'neighboring' activities of activity_uid within the graph of head_node.
       This function will explore within activities to return low-level neighbors as well as the parents they belong to.
       If eligible_activities_only is True then only activities whose prerequisites have been satisfied will be returned
       If head_node is None then the root graph will be used
    '''
    if head_node is None: head_node = self.get_root_node()

    completed_nodes_list = None
    if eligible_activities_only is True:
      completed_nodes_list = CCHTN.get_completed_nodes_list(head_node)

    return CCHTN.get_graph_next_activities_primitives(activity_uid, head_node, completed_nodes_list)

  def get_next_activities(self, activity_uid, eligible_activities_only=False, head_node=None):
    '''Returns (node, parent) pairs for all 'neighboring' activities of activity_uid within the graph of head_node.

       If eligible_activities_only is True then only activities whose prerequisites have been satisfied will be returned
       If head_node is None then the root graph will be used
    '''
    if head_node is None: head_node = self.get_root_node()

    completed_nodes_list = None
    if eligible_activities_only is True:
      completed_nodes_list = CCHTN.get_completed_nodes_list(head_node)

    return CCHTN.get_graph_next_activities(activity_uid, head_node, completed_nodes_list)

  '''
    Graph Contraction / Tree Construction Functions
  '''
  # TODO
  def find_cliques(self, parent_activity_name=None):
    '''
      Returns a list of cliques in the subgraph owned by parent_activity_name
    '''
    raise NotImplementedError()

  # TODO
  def find_chains(self, parent_activity_name=None):
    '''
      Returns a list of chains in the subgraph owned by parent_activity_name
    '''
    raise NotImplementedError()

  # TODO
  def contract_nodes(self, node_list, subgraph_name, parent_activity_name=None):
    '''
      Replaces nodes in node_list within parent_activity_name's subgraph with a single meta-node named subgraph_name.
      The contracted nodes are placed in a subgraph for the activity 'subgraph_name'
    '''

    # Find edges incoming to node_list

    # Find edges outgoing from node_list

    # Isolate subgraph in main graph by removing all non-internal edges

    # Store all internal subgraph edges in list

    # Create metanode

    # Add edges from incoming_list to (origin, metanode)

    # Add edges from outgoing_list to (metanode, destination)

    # Create subgraph

    # Add subgraph nodes

    # Add subgraph edges

    # Record initiation node as any node that had incoming edges from outside subgraph

    raise NotImplementedError()

  @staticmethod
  def get_subgraph(subgraph_node=None):
    '''Returns a Graph object from node "subgraph_node"
    '''
    if 'graph' not in subgraph_node: return None #raise Exception('No subgraph within node %s' % subgraph_node['uid'])
    return subgraph_node['graph']

  @staticmethod
  def is_metanode(activity_node):
    '''Returns True if activity contains a subgraph, indicating its a meta activity
    is_metanode(graph_node_dict)
      -- Returns true of node has a subgraph (activity_id_or_node['graph'] exists)
    '''
    if isinstance(activity_node, dict): # Actual node was passed in
      return 'graph' in activity_node and activity_node['graph'] is not None
    else: # In case someone passes in a UID string
      raise Exception('Invalid activity_node type passed. Expected- Dict, Received- %s' % type(activity_node))

  @staticmethod
  def get_node_from_graph(node_uid, head_node):
    '''Returns the node dict from head_node['graph'] that matches node_uid
    '''
    if 'graph' not in head_node: raise Exception("Node %s has no subgraph." % head_node['uid'])
    root_graph = head_node['graph']
    if node_uid in root_graph.node: return root_graph.node[node_uid]

    for node_key in root_graph.node:
      node = root_graph.node[node_key]

      if 'graph' in node:
        result = CCHTN.get_node_from_graph(node_uid, node['graph'])
        if result is not None: return result

    return None

  @staticmethod
  def annotate_initiation_termination_nodes(head_node):
    ''' Populates initiation and termination node lists for head_node and all subgraphs within head_node
    '''

    open_list = [head_node]
    while len(open_list) > 0:
      cur_node = open_list.pop()
      if CCHTN.is_metanode(cur_node) is False: continue
      initiation_node_ids = []
      termination_node_ids = []
      subgraph = CCHTN.get_subgraph(cur_node)
      if cur_node['skillType'] == 'chain':
        initiation_node_ids.append(cur_node['child_ordering'][0])
        termination_node_ids.append(cur_node['child_ordering'][-1])
      elif cur_node['skillType'] == 'clique':
        initiation_node_ids.extend(subgraph.nodes())
        termination_node_ids.extend(subgraph.nodes())
      CCHTN.mark_initiation_nodes(initiation_node_ids, cur_node)
      CCHTN.mark_termination_nodes(termination_node_ids, cur_node)

      for node in subgraph.nodes(True):
        if CCHTN.is_metanode(node) is True: open_list.append(node)


  @staticmethod
  def get_sequence_likelihood(head_node, node_uid_history, invalid_transition_likelihood=0.00001):
    '''Returns a probability of a particular sequence occurring given a graph and a trajectory
       TODO: Incorporate edge likelihoods instead of assuming uniform transition
    '''
    if len(node_uid_history) == 0:
      return 1.0

    path_idx = 0  # Track progress through tracing node_uid_history

    next_candidate_uids = CCHTN.get_initiation_nodes(head_node) # Start with valid initiation nodes
    likelihood = 1.0 # Base 1.0 likelihood to be reduced along the way
    while path_idx < len(node_uid_history):
      cur_node_uid = node_uid_history[path_idx] # Check to see if there was a valid transition into the 'current' node
      if cur_node_uid in next_candidate_uids:
        likelihood *= 1. / len(next_candidate_uids) # Assume uniform random probability across valid edges
      else:
        likelihood *= invalid_transition_likelihood # No direct path to next node, assume penalty and keep going

      # Get all eligible next nodes to traverse, given the completion status thus far
      next_candidate_uids = [node['uid'] for node in CCHTN.get_graph_next_activities(cur_node_uid, head_node, node_uid_history[:path_idx+1])]

      path_idx += 1 # Proceed down the provided history

    return likelihood

  @staticmethod
  def get_initiation_nodes(metanode):
    '''Returns a list of all initiation nodes that belong to subgraph (metanode)
    '''
    try:
      return metanode['initiation_nodes']
    except:
      raise Exception('get_initiation_nodes argument %s has no subgraph.' % metanode)

  @staticmethod
  def get_termination_nodes(metanode):
    '''Returns a list of all termination nodes that belong to subgraph (metanode)
    '''
    try:
      return metanode['termination_nodes']
    except:
      raise Exception('get_termination_nodes argument %s has no subgraph.' % metanode)

  @staticmethod
  def get_graph_completion_status(head_node):
    ''' Returns completion status of the given node. If activity_node is a metanode, return complete only if all sub-nodes are complete.
    '''
    if CCHTN.is_metanode(head_node):
      complete = True
      subgraph = CCHTN.get_subgraph(head_node)
      for node_uid in subgraph.node:
        if 'completed' not in subgraph.node[node_uid] or subgraph.node[node_uid]['completed'] is not True:
          complete = CCHTN.get_graph_completion_status(subgraph.node[node_uid])
          if complete is False:
            break
      head_node['completed'] = complete


    if 'completed' not in head_node: head_node['completed'] = False
    return head_node['completed']

  @staticmethod
  def get_graph_next_activities_primitives(activity_uid, head_node, completed_nodes_list=None):
    '''
    Returns a list of nodes of primitives that follow the node with uid activity_uid in head_node['graph']
    If completed_nodes_list is not None, then check prerequisites on edges from activity_uid's node to make
    sure all prereqs are in completed_nodes_list before adding it to next_activities
    '''
    # Get next activities (at same level of graph)
    activity_nodes = CCHTN.get_graph_next_activities(activity_uid, head_node, completed_nodes_list)

    # Expand all nodes down to their primitive elements
    primitive_activity_nodes = []
    open_list = [i for i in activity_nodes]
    while len(open_list) > 0:
      node = open_list.pop()
      if CCHTN.is_metanode(node):
        node_graph = CCHTN.get_subgraph(node)
        open_list.extend([node_graph.node[x] for x in CCHTN.get_initiation_nodes(node)])
      else:
        primitive_activity_nodes.append(node)

    return primitive_activity_nodes

  @staticmethod
  def get_graph_next_activities(activity_uid, head_node, completed_nodes_uid_list=None):
    '''
    Returns a list of nodes in head_node that follow the node with uid activity_uid
    If completed_nodes_list is not None, then check prerequisites on edges from activity_uid's node to make
    sure all prereqs are in the completed_nodes_list before adding it to next_activities
    '''
    head_graph = CCHTN.get_subgraph(head_node)
    activity_nodes = []

    if activity_uid is None:
      # No current activity = no progress thus far
      activity_nodes = [head_graph.node[node_uid] for node_uid in CCHTN.get_initiation_nodes(head_node)]
    else:
      activity_edges = head_graph.out_edges(activity_uid)
      # Check to remove all edges without fulfilled prereqs
      if completed_nodes_uid_list is not None:
        for edge_from, edge_to in activity_edges:
          edge_data = head_graph.get_edge_data(edge_from, edge_to)
          if edge_data is None or 'prerequisites' not in edge_data:
            if edge_to not in completed_nodes_uid_list:
              activity_nodes.append(head_graph.node[edge_to])
          else:
            prereqs_satisfied = True
            for prereq in edge_data['prerequisites']:
              if prereq != activity_uid and prereq not in completed_nodes_uid_list:
                prereqs_satisfied = False
                break
            if prereqs_satisfied is True and edge_to not in completed_nodes_uid_list:
              activity_nodes.append(head_graph.node[edge_to])
      else:
        activity_nodes = [head_graph.node[node_uid] for node_uid in head_graph.neighbors(activity_uid)]

    return activity_nodes

  @staticmethod
  def get_graph_all_node_uids(head_node):
    '''Traverse head_node's subgraphs and return a list of all node uids
    '''
    uid_list = []
    open_list = [head_node]

    while len(open_list) > 0:
      cur_node = open_list.pop()
      uid_list.append(cur_node['uid'])
      if CCHTN.is_metanode(cur_node):
        subgraph = CCHTN.get_subgraph(cur_node)
        open_list.extend([subgraph.node[nodeuid] for nodeuid in subgraph.nodes()])

    return uid_list

  @staticmethod
  def get_completed_nodes_list(head_node):
    '''Returns a list containing the UIDs of all completed=True nodes in all subgraphs within head_node and of head_node itself
    '''
    completed_list = []
    open_list = [head_node]

    while len(open_list) > 0:
      cur_node = open_list.pop()

      if CCHTN.get_graph_completion_status(cur_node) is True:
        uid_list.append(cur_node['uid'])

      if CCHTN.is_metanode(cur_node):
        subgraph = CCHTN.get_subgraph(cur_node)
        open_list.extend([subgraph.node[nodeuid] for nodeuid in subgraph.nodes()])

    return completed_list

