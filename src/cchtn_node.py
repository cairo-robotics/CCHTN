#!/usr/bin/python
# -*- coding: utf-8 -*-
"""
Created on Tue Jan 10 11:21:37 2017

Runs ROS Services for CCHTN web interface

@author: brad
"""

import rospy
from CCHTN import CCHTN
from cchtn import srv
import json

from os import listdir
from os.path import isfile, join


active_cchtn = None
cchtn_directory = '/home/brad/ROS/src/cchtn/models/tasks/'
skills_directory = '/home/brad/ROS/src/cchtn/models/skills/'


def save_task_hierarchy_handler(req):
  global active_cchtn
  res = srv.SaveTaskHierarchyResponse()

  if active_cchtn is None:
    rospy.logerr("No CCHTN is active.")
    res.success = False
    return res

  active_cchtn.save(cchtn_directory+req.task_file_name+".cchtn")
  res = srv.SaveTaskHierarchyResponse()
  res.success = True
  res.serialized_task = active_cchtn.to_JSON()
  return res

def load_task_hierarchy_handler(req):
  global active_cchtn
  active_cchtn = CCHTN.load(cchtn_directory+req.task_file_name+".cchtn")
  res = srv.LoadTaskHierarchyResponse()

  if active_cchtn is None:
    rospy.logerr("Could not load CCHTN named %s.", req.task_file_name)
    res.success = False
    return res

  res.success = True
  res.serialized_task = active_cchtn.to_JSON()
  return res

def get_known_tasks_handler(req):
  global cchtn_directory
  task_files = [f[:-6] for f in listdir(cchtn_directory) if isfile(join(cchtn_directory, f)) and f[-6:] == '.cchtn']
  res = srv.GetKnownTasksResponse()
  res.filenames = task_files
  res.success = True
  return res
  
def get_known_skills_handler(req):
  global skills_directory
  skill_files = [f[:-6] for f in listdir(skills_directory) if isfile(join(skills_directory, f)) and f[-6:] == '.skill'] # Append skills the robot can perform
  skill_files.extend([f[:-6] for f in listdir(skills_directory) if isfile(join(skills_directory, f)) and f[-6:] == '.model']) # Also append skills we have human models for
  res = cchtn.srv.GetKnownSkillsResponse()
  res.skills = skill_files
  res.success = True
  return res

def get_task_hierarchy_handler(req):
  global active_cchtn
  res = srv.GetTaskHierarchyResponse()

  if active_cchtn is None:
    rospy.logerr("No CCHTN is active.")
    res.success = False
    return res    

  res.serialized_head = active_cchtn.to_JSON()
  res.success = True
  return res

def set_task_hierarchy_handler(req):
  global active_cchtn
  res = srv.SetTaskHierarchyResponse()
  cchtn = CCHTN.from_JSON(req.serialized_head)
  res.success = cchtn is not None

  if cchtn is not None: active_cchtn = cchtn
  else: rospy.logerr("Error -- invalid CCHTN loaded from JSON.")

  return res


if __name__ == '__main__':
  rospy.init_node('CC_HTN_Server')
  rospy.Service('SaveTaskHierarchy', srv.SaveTaskHierarchy, save_task_hierarchy_handler)
  rospy.Service('LoadTaskHierarchy', srv.LoadTaskHierarchy, load_task_hierarchy_handler)
  rospy.Service('GetKnownTasks', srv.GetKnownTasks, get_known_tasks_handler)
  rospy.Service('GetKnownSkills', srv.GetKnownSkills, get_known_skills_handler)
  rospy.Service('GetHierarchy', srv.GetTaskHierarchy, get_task_hierarchy_handler)
  rospy.Service('SetTaskHierarchy', srv.SetTaskHierarchy, set_task_hierarchy_handler)

  print "CC-HTN Server Online"

  rospy.spin()