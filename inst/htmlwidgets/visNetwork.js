// Add shim for Function.prototype.bind() from:
  // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/bind#Compatibility
// for fix some RStudio viewer bug (Desktop / windows)
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }
    
    var aArgs = Array.prototype.slice.call(arguments, 1),
    fToBind = this,
    fNOP = function () {},
    fBound = function () {
      return fToBind.apply(this instanceof fNOP && oThis
                           ? this
                           : oThis,
                           aArgs.concat(Array.prototype.slice.call(arguments)));
    };
    
    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();
    
    return fBound;
  };
}

function clone(obj) {
    if(obj === null || typeof(obj) != 'object')
        return obj;    
    var temp = new obj.constructor(); 
    for(var key in obj)
        temp[key] = clone(obj[key]);    
    return temp;
}

HTMLWidgets.widget({
  
  name: 'visNetwork',
  
  type: 'output',
  
  initialize: function(el, width, height) {
    return {
    };
  },
  
  renderValue: function(el, x, instance) {
    
    var data;
    var nodes;
    var edges;
    
    // highlight nearest variables & selectedBy
    var allNodes;
    var highlightActive = false;
    var nodesDataset ;
    var edgesDataset ;
    
    // selectedBy
    var allSelNodes;
    var selectActive = false;
    var nodesSelDataset ;
    var edgesSelDataset ;
    
    
    // clustergin by zoom variables
    var clusterIndex = 0;
    var clusters = [];
    var lastClusterZoomLevel = 0;
    var clusterFactor;
    var ctrlwait = 0;
    
    // legend control
    var addlegend = false;
    
    // clear el.id (for shiny...)
    document.getElementById(el.id).innerHTML = "";  
    
    var changeInput = function(id, data) {
            Shiny.onInputChange(el.id + '_' + id, data);
    };
          
    //*************************
    //idselection
    //*************************
    
    // id nodes selection : add a list on top left
    // actually only with nodes + edges data (not dot and gephi)
    
    if(x.idselection && x.nodes){  
      var option;
      //Create and append select list
      var selnodes = HTMLWidgets.dataframeToD3(x.nodes);
      var selectList = document.createElement("select");
      
      selectList.setAttribute('class', 'dropdown');
      selectList.setAttribute('style', 'width: 150px; height: 26px');
      
      selectList.id = "nodeSelect"+el.id;
      
      document.getElementById(el.id).appendChild(selectList);
      
      option = document.createElement("option");
      option.value = "";
      option.text = "Select by id";
      selectList.appendChild(option);
      
      //Create and append the options
      for (var i = 0; i < selnodes.length; i++) {
        option = document.createElement("option");
        option.value = selnodes[i].id;
        if(selnodes[i].label){
          option.text = selnodes[i].label;
        }else{
          option.text = selnodes[i].id;
        }
        selectList.appendChild(option);
      }
      
      if (window.Shiny){
        changeInput('selected', document.getElementById("nodeSelect"+el.id).value);
      }
      
      selectList.onchange =  function(){
        if(instance.network)
          currentid = document.getElementById("nodeSelect"+el.id).value;
        if(currentid === ""){
          instance.network.selectNodes([]);
        }else{
          instance.network.selectNodes([currentid]);
        }
        if(x.highlight){
          neighbourhoodHighlight(instance.network.getSelection());
        }
        if (window.Shiny){
          changeInput('selected', document.getElementById("nodeSelect"+el.id).value);
        }
        if(x.selectedBy !== undefined){
          selectNode = document.getElementById('selectedBy'+el.id);
          selectNode.value = "";
          if (window.Shiny){
            changeInput('selectedBy', "");
          }
        }
      };
      var hr = document.createElement("hr");
      hr.setAttribute('style', 'height:0px; visibility:hidden; margin-bottom:-1px;');
      document.getElementById(el.id).appendChild(hr);  
      
    }
    
    //*************************
    //selectedBy
    //*************************
    
    // selectedBy : add a list on top left
    // actually only with nodes + edges data (not dot and gephi)
    if(x.selectedBy !== undefined){  
      var option2;
      
      //Create and append select list
      var selnodes2 = HTMLWidgets.dataframeToD3(x.nodes);
      var selectList2 = document.createElement("select");
      
      selectList2.setAttribute('class', 'dropdown');
      selectList2.setAttribute('style', 'width: 150px; height: 26px');
      
      selectList2.id = "selectedBy"+el.id;
      
      document.getElementById(el.id).appendChild(selectList2);
      
      option2 = document.createElement("option");
      option2.value = "";
      option2.text = "Select by " + x.selectedBy;
      selectList2.appendChild(option2);
      
      //Create and append the options
      for (var i2 = 0; i2 < x.selectedValues.length; i2++) {
        option2 = document.createElement("option");
        option2.value = x.selectedValues[i2];
        option2.text = x.selectedValues[i2];
        selectList2.appendChild(option2);
      }
      
      selectList2.onchange =  function(){
        if(instance.network){
          selectedBy = document.getElementById("selectedBy"+el.id).value;
          selectedHighlight(selectedBy);
        }
        if (window.Shiny){
          changeInput('selectedBy', document.getElementById("selectedBy"+el.id).value);
        }
        if(x.idselection){
          selectNode = document.getElementById('nodeSelect'+el.id);
          selectNode.value = "";
          if (window.Shiny){
            changeInput('selected', "");
          }
        }
      };
      
      if (window.Shiny){
        changeInput('selectedBy', document.getElementById("selectedBy"+el.id).value);
      }
    }
    
    // divide page
    var maindiv  = document.createElement('div');
    maindiv.id = "maindiv"+el.id;
    maindiv.setAttribute('style', 'height:100%');
    document.getElementById(el.id).appendChild(maindiv);
    
    var graph = document.createElement('div');
    graph.id = "graph"+el.id;
    
    if(x.legend !== undefined){
      if((x.groups && x.legend.useGroups) || (x.legend.nodes !== undefined) || (x.legend.edges !== undefined)){
        addlegend = true;
      }
    }
    
    if(addlegend){
      var legendwidth = x.legend.width*100;
      var legend = document.createElement('div');
      
      var pos = x.legend.position;
      var pos2 = "right";
      if(pos == "right"){
        pos2 = "left";
      }
      
      legend.id = "legend"+el.id;
      legend.setAttribute('style', 'float:' + pos + '; width:'+legendwidth+'%;height:100%');
      document.getElementById("maindiv"+el.id).appendChild(legend);
      
      graph.setAttribute('style', 'float:' + pos2 + '; width:'+(100-legendwidth)+'%;height:100%');
    }else{
      graph.setAttribute('style', 'float:right; width:100%;height:100%');
    }
    
    // fontAwesome unicode
    if(x.options.groups){
      for (var gr in x.options.groups){
        if(x.options.groups[gr].icon){
          x.options.groups[gr].icon.code = JSON.parse( '"'+'\\u' + x.options.groups[gr].icon.code + '"');
        }
      }
    }
    
    if(x.options.nodes.icon){
        x.options.nodes.icon.code = JSON.parse( '"'+'\\u' + x.options.nodes.icon.code + '"');
    }

    document.getElementById("maindiv"+el.id).appendChild(graph);
    
    //*************************
    //legend
    //*************************
    if(addlegend){
      
      var legendnodes = new vis.DataSet();
      var legendedges = null;
      var datalegend;
      var tmpnodes;
      
      var optionslegend = {
        interaction:{
          dragNodes: false,
          dragView: false,
          selectable: false,
          zoomView: false
        },
        physics:{
          stabilization: false
        }
      };
      
      var mynetwork = document.getElementById('legend'+el.id);
      var lx = - mynetwork.clientWidth / 2 + 50;
      var ly = - mynetwork.clientWidth / 2 + 50;
      var step = 70;

      if(x.groups && x.legend.useGroups){
    
        for (var g1 = 0; g1 < x.groups.length; g1++){
          legendnodes.add({id: null, x : lx, y : ly+g1*step, label: x.groups[g1], group: x.groups[g1], value: 1, mass:0});
        }
      
        if(x.options.groups){
          optionslegend.groups = clone(x.options.groups);
          for (var grp in optionslegend.groups) {
            if(optionslegend.groups[grp].shape === "icon"){
              optionslegend.groups[grp].icon.size = 50;
            }
          }
        }
      }
      
      if(x.legend.nodes !== undefined){
        
        tmpnodes = x.legend.nodes;
        if(tmpnodes.length === undefined){
          tmpnodes = new Array(tmpnodes);
        }
        
        for (var nd in tmpnodes){
          if(tmpnodes[nd].icon){
            tmpnodes[nd].icon.code = JSON.parse( '"'+'\\u' + tmpnodes[nd].icon.code + '"');
          }
        }

        for (var g = 0; g < tmpnodes.length; g++){
          tmpnodes[g].x = lx;
          tmpnodes[g].y = ly+(g+legendnodes.length)*step;
          if(tmpnodes[g].value === undefined && tmpnodes[g].size === undefined){
            tmpnodes[g].value = 1;
          }
          if(tmpnodes[g].id !== undefined){
            tmpnodes[g].id = null;
          }
          tmpnodes[g].mass = 0;
        }
        legendnodes.add(tmpnodes);
      }
      
      if(x.legend.edges !== undefined){
        legendedges = x.legend.edges;
        if(legendedges.length === undefined){
          legendedges = new Array(legendedges);
        }

        var ctrl = legendnodes.length;
        
        for (var edg = 0; edg < (legendedges.length); edg++){
          
          legendedges[edg].from = edg*2+1;
          legendedges[edg].to = edg*2+2;
          legendedges[edg].physics = false;
          legendedges[edg].smooth = false;
          legendedges[edg].value = undefined;

          if(legendedges[edg].arrows === undefined){
            legendedges[edg].arrows = 'to';
          }
          
          if(legendedges[edg].width === undefined){
            legendedges[edg].width = 1;
          }

          legendnodes.add({id: edg*2+1, x : lx - mynetwork.clientWidth/3, y : ly+ctrl*step, size : 0.0001, hidden : true, shape : "square", mass:0});
          legendnodes.add({id: edg*2+2, x : lx + mynetwork.clientWidth/3, y : ly+ctrl*step, size : 0.0001, hidden : true, shape : "square", mass:0});
          ctrl = ctrl+1;
        }
      }
      
      datalegend = {
        nodes: legendnodes, 
        edges: legendedges       
      };
          
      instance.legend = new vis.Network(document.getElementById("legend"+el.id), datalegend, optionslegend);
    }
    
    if(x.nodes){
      
      // network
      nodes = new vis.DataSet();
      edges = new vis.DataSet();
      
      nodes.add(HTMLWidgets.dataframeToD3(x.nodes));
      edges.add(HTMLWidgets.dataframeToD3(x.edges));
      
      data = {
        nodes: nodes,
        edges: edges
      };
      
    }else if(x.dot){
      data = {
        dot: x.dot
      };
    }else if(x.gephi){
      data = {
        gephi: x.gephi
      };
    } 
    

    var options = x.options;
    
    //*************************
    //manipulation
    //*************************
    if(x.options.manipulation.enabled){
      
      var style = document.createElement('style');
      style.type = 'text/css';
      style.appendChild(document.createTextNode(x.datacss));
      document.getElementsByTagName("head")[0].appendChild(style);
      
      var div = document.createElement('div');
      div.id = 'network-popUp';
      
      div.innerHTML = '<span id="operation">node</span> <br>\
      <table style="margin:auto;"><tr>\
      <td>id</td><td><input id="node-id" value="new value"></td>\
      </tr>\
      <tr>\
      <td>label</td><td><input id="node-label" value="new value"> </td>\
      </tr></table>\
      <input type="button" value="save" id="saveButton"></button>\
      <input type="button" value="cancel" id="cancelButton"></button>';
      
      document.getElementById(el.id).appendChild(div);
      
      options.manipulation.addNode = function(data,callback) {
        document.getElementById('operation').innerHTML = "Add Node";
        document.getElementById('node-id').value = data.id;
        document.getElementById('node-label').value = data.label;
        document.getElementById('saveButton').onclick = saveData.bind(this, data, callback);
        document.getElementById('cancelButton').onclick = clearPopUp.bind();
        document.getElementById('network-popUp').style.display = 'block';
      };
      
      options.manipulation.editNode = function(data,callback) {
        document.getElementById('operation').innerHTML = "Edit Node";
        document.getElementById('node-id').value = data.id;
        document.getElementById('node-label').value = data.label;
        document.getElementById('saveButton').onclick = saveData.bind(this, data, callback);
        document.getElementById('cancelButton').onclick = cancelEdit.bind(this,callback);
        document.getElementById('network-popUp').style.display = 'block';
      };
      
      options.manipulation.addEdge = function(data,callback) {
        if (data.from == data.to) {
          var r = confirm("Do you want to connect the node to itself?");
          if (r === true) {
            callback(data);
          }
        }
        else {
          callback(data);
        }
      };
    }
    
    // create network
    instance.network = new vis.Network(document.getElementById("graph"+el.id), data, options);
    
    // add Events
    if(x.events !== undefined){
      for (var key in x.events) {
        instance.network.on(key, x.events[key]);
      }
    }

    //*************************
    // Selected Highlight
    //*************************
  
    function selectedHighlight(value) {
    
      var sel = x.selectedBy;
          
      if(sel == "label"){
        sel = "hiddenLabel";
      }
      
      if(sel == "color"){
        sel = "hiddenColor";
      }
    
      if (value !== "") {
      
        selectActive = true;
        
        // mark all nodes as hard to read.
        for (var nodeId in allSelNodes) {
          if (allSelNodes[nodeId].hiddenColor === undefined & allSelNodes[nodeId].color !== 'rgba(200,200,200,0.5)') {
            allSelNodes[nodeId].hiddenColor = allSelNodes[nodeId].color;
          }
          allSelNodes[nodeId].color = 'rgba(200,200,200,0.5)';
          if (allSelNodes[nodeId].hiddenLabel === undefined) {
            allSelNodes[nodeId].hiddenLabel = allSelNodes[nodeId].label;
            allSelNodes[nodeId].label = undefined;
          }
        
          if(allSelNodes[nodeId][sel] === value){
            if (allSelNodes[nodeId].hiddenColor !== undefined) {
              allSelNodes[nodeId].color = allSelNodes[nodeId].hiddenColor;
            }else{
              allSelNodes[nodeId].color = undefined;
            }
            if (allSelNodes[nodeId].hiddenLabel !== undefined) {
              allSelNodes[nodeId].label = allSelNodes[nodeId].hiddenLabel;
              allSelNodes[nodeId].hiddenLabel = undefined;
            }
          }
        }
      }
      else if (selectActive === true) {
      // reset all nodes
        for (var nodeId in allSelNodes) {
          if (allSelNodes[nodeId].hiddenColor !== undefined) {
            allSelNodes[nodeId].color = allSelNodes[nodeId].hiddenColor;
            allSelNodes[nodeId].hiddenColor = undefined;
          }else{
            allSelNodes[nodeId].color = undefined;
          }
          if (allSelNodes[nodeId].hiddenLabel !== undefined) {
            allSelNodes[nodeId].label = allSelNodes[nodeId].hiddenLabel;
            allSelNodes[nodeId].hiddenLabel = undefined;
          }
        }
      
        selectActive = false
      }
    
      // transform the object into an array
      var updateArray = [];
      for (nodeId in allSelNodes) {
        if (allSelNodes.hasOwnProperty(nodeId)) {
          updateArray.push(allSelNodes[nodeId]);
        }
      }
      nodesSelDataset.update(updateArray);
    } 
  
   // actually only with nodes + edges data (not dot and gephi)
    if(x.selectedBy !== undefined && x.nodes){
      nodesSelDataset = nodes; 
      edgesSelDataset = edges;
      allSelNodes = nodesSelDataset.get({returnType:"Object"});
    }
    
    //*************************
    //Highlight
    //*************************
    
    function neighbourhoodHighlight(params) {
      var selectNode;
      var changeInput = function(id, data) {
        Shiny.onInputChange(el.id + '_' + id, data);
      };
      if (params.nodes.length > 0) {
        
        if(x.idselection){
          selectNode = document.getElementById('nodeSelect'+el.id);
          selectNode.value = params.nodes;
          if (window.Shiny){
            changeInput('selected', selectNode.value);
          }
        }
        
        highlightActive = true;
        var i,j;
        var selectedNode = params.nodes[0];
        var degrees = x.degree;
        
        // mark all nodes as hard to read.
        for (var nodeId in allNodes) {
          if (allNodes[nodeId].hiddenColor === undefined & allNodes[nodeId].color !== 'rgba(200,200,200,0.5)') {
            allNodes[nodeId].hiddenColor = allNodes[nodeId].color;
          }
          allNodes[nodeId].color = 'rgba(200,200,200,0.5)';
          if (allNodes[nodeId].hiddenLabel === undefined) {
            allNodes[nodeId].hiddenLabel = allNodes[nodeId].label;
            allNodes[nodeId].label = undefined;
          }
        }
        
        if(degrees > 0){
          var connectedNodes = instance.network.getConnectedNodes(selectedNode);
        }else{
          var connectedNodes = [selectedNode];
        }
        
        var allConnectedNodes = [];
        
        // get the nodes to color
        if(degrees >= 2){
          for (i = 2; i <= degrees; i++) {
            var currentlength = connectedNodes.length;
            for (j = 0; j < currentlength; j++) {
              connectedNodes = connectedNodes.concat(instance.network.getConnectedNodes(connectedNodes[j]));
            }
          }
        }
        
        // nodes to just label
        for (j = 0; j < connectedNodes.length; j++) {
            allConnectedNodes = allConnectedNodes.concat(instance.network.getConnectedNodes(connectedNodes[j]));
        }

        // all second degree nodes get a different color and their label back
        for (i = 0; i < allConnectedNodes.length; i++) {
          //allNodes[allConnectedNodes[i]].color = 'rgba(150,150,150,0.75)';
          if (allNodes[allConnectedNodes[i]].hiddenLabel !== undefined) {
            allNodes[allConnectedNodes[i]].label = allNodes[allConnectedNodes[i]].hiddenLabel;
            allNodes[allConnectedNodes[i]].hiddenLabel = undefined;
          }
        }
        
        // all first degree nodes get their own color and their label back
        for (i = 0; i < connectedNodes.length; i++) {
          if (allNodes[connectedNodes[i]].hiddenColor !== undefined) {
            allNodes[connectedNodes[i]].color = allNodes[connectedNodes[i]].hiddenColor;
          }else{
            allNodes[connectedNodes[i]].color = undefined;
          }
          if (allNodes[connectedNodes[i]].hiddenLabel !== undefined) {
            allNodes[connectedNodes[i]].label = allNodes[connectedNodes[i]].hiddenLabel;
            allNodes[connectedNodes[i]].hiddenLabel = undefined;
          }
        }
        
        
        // the main node gets its own color and its label back.
        if (allNodes[selectedNode].hiddenColor !== undefined) {
          allNodes[selectedNode].color = allNodes[selectedNode].hiddenColor;
        }else{
          allNodes[selectedNode].color = undefined;
        }
        if (allNodes[selectedNode].hiddenLabel !== undefined) {
          allNodes[selectedNode].label = allNodes[selectedNode].hiddenLabel;
          allNodes[selectedNode].hiddenLabel = undefined;
        }
      }
      else if (highlightActive === true) {
        if(x.idselection){
          selectNode = document.getElementById('nodeSelect'+el.id);
          selectNode.value = "";
          if (window.Shiny){
            changeInput('selected', "");
          }
        }
        
        if(x.selectedBy !== undefined){
          selectNode = document.getElementById('selectedBy'+el.id);
          selectNode.value = "";
          if (window.Shiny){
            changeInput('selectedBy', "");
          }
        }
        
        // reset all nodes

        for (var nodeId in allNodes) {
          if (allNodes[nodeId].hiddenColor !== undefined) {
            allNodes[nodeId].color = allNodes[nodeId].hiddenColor;
            allNodes[nodeId].hiddenColor = undefined;
          }else{
            allNodes[nodeId].color = undefined;
          }
          if (allNodes[nodeId].hiddenLabel !== undefined) {
            allNodes[nodeId].label = allNodes[nodeId].hiddenLabel;
            allNodes[nodeId].hiddenLabel = undefined;
          }
        }
        
        highlightActive = false
      }
      else if(x.selectedBy !== undefined){
        selectNode = document.getElementById('selectedBy'+el.id);
        selectNode.value = "";
        if (window.Shiny){
          changeInput('selectedBy', "");
        }
      }
      
      // transform the object into an array
      var updateArray = [];
      for (nodeId in allNodes) {
        if (allNodes.hasOwnProperty(nodeId)) {
          updateArray.push(allNodes[nodeId]);
        }
      }
      nodesDataset.update(updateArray);
    }
    
    function onClickIDSelection(selectedItems) {
      var selectNode;
      var changeInput = function(id, data) {
        Shiny.onInputChange(el.id + '_' + id, data);
      };
      
      if(x.idselection){
        if (selectedItems.nodes.length !== 0) {
          selectNode = document.getElementById('nodeSelect'+el.id);
          selectNode.value = selectedItems.nodes;
          if (window.Shiny){
            changeInput('selected', selectNode.value);
          }
        }else{
          selectNode = document.getElementById('nodeSelect'+el.id);
          selectNode.value = "";
          if (window.Shiny){
            changeInput('selected', "");
          }
        } 
      }
      
      if(x.selectedBy !== undefined){
        if (selectedItems.nodes.length === 0) {
          selectNode = document.getElementById('selectedBy'+el.id);
          selectNode.value = "";
          selectedHighlight("");
          if (window.Shiny){
            changeInput('selectedBy', "");
          }
        }
      }
    }
    
    // actually only with nodes + edges data (not dot and gephi)
    if(x.highlight && x.nodes){
      nodesDataset = nodes; 
      edgesDataset = edges;
      allNodes = nodesDataset.get({returnType:"Object"});
      instance.network.on("click",neighbourhoodHighlight);
    }else if((x.idselection || x.selectedBy !== undefined) && x.nodes){
      instance.network.on("click",onClickIDSelection);
    }
    
    //*************************
    //manipulation
    //*************************
    function clearPopUp() {
      document.getElementById('saveButton').onclick = null;
      document.getElementById('cancelButton').onclick = null;
      document.getElementById('network-popUp').style.display = 'none';
    }
    
    function saveData(data,callback) {
      data.id = document.getElementById('node-id').value;
      data.label = document.getElementById('node-label').value;
      clearPopUp();
      callback(data);
    }
    
    function cancelEdit(callback) {
      clearPopUp();
      callback(null);
    }
    
    //*************************
    // CLUSTERING
    //*************************
    
    if(x.clusteringGroup || x.clusteringColor || x.clusteringHubsize || x.clusteringConnection){
      
      var clusterbutton = document.createElement("input");
      clusterbutton.id = "backbtn"+el.id;
      clusterbutton.setAttribute('type', 'button');  
      clusterbutton.setAttribute('value', 'Reinitialize clustering'); 
      clusterbutton.setAttribute('style', 'background-color:#FFFFFF;border: none');
      document.getElementById(el.id).appendChild(clusterbutton);
      
      clusterbutton.onclick =  function(){
        instance.network.setData(data);
        if(x.clusteringColor){
          clusterByColor();
        }
        if(x.clusteringGroup){
          clusterByGroup();
        }
        if(x.clusteringHubsize){
          clusterByHubsize();
        }
        if(x.clusteringConnection){
          clusterByConnection();
        }
        instance.network.fit();
      }
    }
    
    if(x.clusteringGroup || x.clusteringColor || x.clusteringOutliers || x.clusteringHubsize || x.clusteringConnection){
      // if we click on a node, we want to open it up!
      instance.network.on("doubleClick", function (params) {
        if (params.nodes.length == 1) {
          if (instance.network.isCluster(params.nodes[0]) == true) {
            instance.network.openCluster(params.nodes[0]);
            instance.network.fit()
          }
        }
      });
    }
    //*************************
    //clustering Connection
    //*************************
    
    if(x.clusteringConnection){
      
      function clusterByConnection() {
        for (var i = 0; i < x.clusteringConnection.nodes.length; i++) {
          instance.network.clusterByConnection(x.clusteringConnection.nodes[i])
        }
      }
      clusterByConnection();
    }
    
    //*************************
    //clustering hubsize
    //*************************
    
    if(x.clusteringHubsize){
      
      function clusterByHubsize() {
        var clusterOptionsByData = {
          processProperties: function(clusterOptions, childNodes) {
                  for (var i = 0; i < childNodes.length; i++) {
                      //totalMass += childNodes[i].mass;
                      if(i === 0){
                        //clusterOptions.shape =  childNodes[i].shape;
                        clusterOptions.color =  childNodes[i].color.background;
                      }else{
                        //if(childNodes[i].shape !== clusterOptions.shape){
                          //clusterOptions.shape = 'database';
                        //}
                        if(childNodes[i].color.background !== clusterOptions.color){
                          clusterOptions.color = 'grey';
                        }
                      }
                  }
            clusterOptions.label = "[" + childNodes.length + "]";
            return clusterOptions;
          },
          clusterNodeProperties: {borderWidth:3, shape:'box', font:{size:30}}
        }
        if(x.clusteringHubsize.size > 0){
          instance.network.clusterByHubsize(x.clusteringHubsize.size, clusterOptionsByData);
        }else{
          instance.network.clusterByHubsize(undefined, clusterOptionsByData);
        }
      }
      
      clusterByHubsize();
    }
    
    if(x.clusteringColor){
      
    //*************************
    //clustering color
    //*************************
    
      function clusterByColor() {
        var colors = x.clusteringColor.colors
        var clusterOptionsByData;
        for (var i = 0; i < colors.length; i++) {
          var color = colors[i];
          clusterOptionsByData = {
              joinCondition: function (childOptions) {
                  return childOptions.color.background == color; // the color is fully defined in the node.
              },
              processProperties: function (clusterOptions, childNodes, childEdges) {
                  var totalMass = 0;
                  for (var i = 0; i < childNodes.length; i++) {
                      totalMass += childNodes[i].mass;
                      if(i === 0){
                        clusterOptions.shape =  childNodes[i].shape;
                      }else{
                        if(childNodes[i].shape !== clusterOptions.shape){
                          clusterOptions.shape = 'database';
                        }
                      }
                  }
                  clusterOptions.value = totalMass;
                  return clusterOptions;
              },
              clusterNodeProperties: {id: 'cluster:' + color, borderWidth: 3, color:color, label:'Cluster on color:' + color}
          }
          instance.network.cluster(clusterOptionsByData);
        }
      }
      
      clusterByColor();
    }

    //*************************
    //clustering groups
    //*************************
    
    if(x.clusteringGroup){
      
      function clusterByGroup() {
        var groups = x.clusteringGroup.groups;
        var clusterOptionsByData;
        for (var i = 0; i < groups.length; i++) {
          var group = groups[i];
          clusterOptionsByData = {
              joinCondition: function (childOptions) {
                  return childOptions.group == group; //
              },
              processProperties: function (clusterOptions, childNodes, childEdges) {
                //console.info(clusterOptions);
                  var totalMass = 0;
                  for (var i = 0; i < childNodes.length; i++) {
                      totalMass += childNodes[i].mass;
                      if(i === 0){
                        clusterOptions.shape =  childNodes[i].shape;
                        clusterOptions.color =  childNodes[i].color.background;
                      }else{
                        if(childNodes[i].shape !== clusterOptions.shape){
                          clusterOptions.shape = 'database';
                        }
                        if(childNodes[i].color.background !== clusterOptions.color){
                          clusterOptions.color = 'grey';
                        }
                      }
                  }
                  clusterOptions.value = totalMass;
                  return clusterOptions;
              },
              clusterNodeProperties: {id: 'cluster:' + group, borderWidth: 3, label:'Cluster on group:' + group}
          }
          instance.network.cluster(clusterOptionsByData);
        }
      }
      clusterByGroup();
    }
  
    //*************************
    //clustering by zoom
    //*************************
    
    if(x.clusteringOutliers){
      
      clusterFactor = x.clusteringOutliers.clusterFactor;
      
      // set the first initial zoom level
      instance.network.on('initRedraw', function() {
        if (lastClusterZoomLevel === 0) {
          lastClusterZoomLevel = instance.network.getScale();
        }
      });

      // we use the zoom event for our clustering
      instance.network.on('zoom', function (params) {
        if(ctrlwait === 0){
        if (params.direction == '-') {
          if (params.scale < lastClusterZoomLevel*clusterFactor) {
            makeClusters(params.scale);
            lastClusterZoomLevel = params.scale;
          }
        }
        else {
          openClusters(params.scale);
        }
        }
      });
    }

    // make the clusters
    function makeClusters(scale) {
        ctrlwait = 1;
        var clusterOptionsByData = {
            processProperties: function (clusterOptions, childNodes) {
                clusterIndex = clusterIndex + 1;
                var childrenCount = 0;
                for (var i = 0; i < childNodes.length; i++) {
                    childrenCount += childNodes[i].childrenCount || 1;
                }
                clusterOptions.childrenCount = childrenCount;
                clusterOptions.label = "# " + childrenCount + "";
                clusterOptions.font = {size: childrenCount*5+30}
                clusterOptions.id = 'cluster:' + clusterIndex;
                clusters.push({id:'cluster:' + clusterIndex, scale:scale});
                return clusterOptions;
            },
            clusterNodeProperties: {borderWidth: 3, shape: 'database', font: {size: 30}}
        }
        instance.network.clusterOutliers(clusterOptionsByData);
        if (x.clusteringOutliers.stabilize) {
            instance.network.stabilize();
        };
        ctrlwait = 0;
    }

    // open them back up!
    function openClusters(scale) {
        ctrlwait = 1;
        var newClusters = [];
        var declustered = false;
        for (var i = 0; i < clusters.length; i++) {
            if (clusters[i].scale < scale) {
                instance.network.openCluster(clusters[i].id);
                lastClusterZoomLevel = scale;
                declustered = true;
            }
            else {
                newClusters.push(clusters[i])
            }
        }
        clusters = newClusters;
        if (x.clusteringOutliers.stabilize) {
            instance.network.stabilize();
        };
        ctrlwait = 0;
    }
    
    //*************************
    //resize
    //*************************
    
    /*window.onresize = function() {

      if(instance.network)
        instance.network.fit();
      if(instance.legend)
        instance.legend.fit();
    } */
      
  },
  
  resize: function(el, width, height, instance) {
      if(instance.network)
        instance.network.fit();
      if(instance.legend)
        instance.legend.fit();
  }
  
});
