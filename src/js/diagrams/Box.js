var helpers = {
    generateDefinitionWithSharedGet: function() {
      var text = arguments[0],
        sharedKey, preffix;

      preffix = (arguments.length > 1) ? arguments[1] : '';
      sharedKey = preffix + text.split('(')[0];

      return Box.generateDefinition(text, d.shared.get(sharedKey));
    },

    addButtons: function(origConf, currentConf) {
      var body = d3.select('body'),
        addDivToBody = function() {
          div = body.insert('div', 'svg');
        },
        appendButtonToDiv = function(cls, value, onclickWrapperFn, argumentToWrapperFn) {
          var wrapperFnName = onclickWrapperFn + 'Wrapper';
          div.append('input').attr({
            type: 'button',
            'class': cls + ' diagrams-diagram-button',
            value: value,
            onclick: 'diagrams.box.' + wrapperFnName + '()' // refactor this by decoupling dependency
          });
          diagrams.box[wrapperFnName] = function() {
            helpers[onclickWrapperFn](argumentToWrapperFn);
          };
        },
        div;

      addDivToBody();
      appendButtonToDiv('diagrams-box-conversion-button', 'Convert to layers diagram', 'convertToLayer', origConf);

      addDivToBody();
      appendButtonToDiv('diagrams-box-collapse-all-button', 'Collapse all', 'collapseAll', currentConf);
      appendButtonToDiv('diagrams-box-expand-all-button', 'Expand all', 'expandAll', currentConf);
    },

    expandOrCollapseAll: function(currentConf, collapseOrExpand) {
      var recursiveFn = function(items) {
        _.each(items, function(item) {
          if (item.hasOwnProperty('collapsed')) helpers[collapseOrExpand + 'Item'](item);
          if (item.items) recursiveFn(item.items);
          if (item.collapsedItems) recursiveFn(item.collapsedItems);
        });
      };

      recursiveFn(currentConf.body);
      helpers.addBodyItemsAndUpdateHeights();
    },

    collapseAll: function(currentConf) {
      helpers.expandOrCollapseAll(currentConf, 'collapse');
    },

    expandAll: function(currentConf) {
      helpers.expandOrCollapseAll(currentConf, 'expand');
    },

    convertToLayer: function(origConf) {
      var convertDataToLayers = function(items) {
          _.each(items, function(item, index) {
            if (_.isString(item)) {
              item = items[index] = {
                text: item
              };
            }
            if (item.description) item.text += ': ' + item.description;
            if (item.items) convertDataToLayers(item.items);
            else item.items = [];
          });
        },
        createLayers = function() {
          var svg = d3.select('svg');

          d3.selectAll('input.diagrams-diagram-button').remove();

          svg.remove();
          d.layer(layersData);
        },
        layersData = [];

      layersData.push({
        text: origConf.name,
        items: origConf.body
      });
      convertDataToLayers(layersData[0].items);
      createLayers();
    },

    collapseItem: function(item) {
      if (item.items.length > 0) {
        item.collapsedItems = item.items;
        item.collapsed = true;
        item.items = [];
      }
    },

    expandItem: function(item) {
      if (item.collapsedItems) {
        item.items = item.collapsedItems;
        delete item.collapsedItems;
        item.collapsed = false;
      }
    },

    generateItem: function(text, description, options, items) {
      var defaultOptions = {
        isLink: false
      };
      options = options || {};
      return {
        text: text,
        description: description || null,
        options: _.defaults(options, defaultOptions),
        items: items || []
      };
    },

    generateContainer: function(text, description, items) {
      if (_.isArray(description)) {
        items = description;
        description = null;
      }

      return helpers.generateItem(text, description, null, items);
    },

    generateLink: function(text, url) {
      return helpers.generateItem(text, url, {
        isLink: true
      });
    },

    generateDefinition: function(text, description) {
      return helpers.generateItem(text, description);
    }
  },
  textGId = 0,
  Box;

Box = class Box extends d.Diagram {
  create(conf) {
    var diagram = this,
      origConf = _.cloneDeep(conf),
      svg = d.svg.generateSvg(),
      width = svg.attr('width') - 40,
      nameHeight = 50,
      boxG = svg.append('g').attr({
        transform: 'translate(20, 20)',
        'class': 'box-diagram'
      }),
      nameG = boxG.append('g'),
      rowHeight = 30,
      depthWidth = 35,
      collapseIfNecessary = function(el, item) {
        if (item.items.length > 0 || item.collapsedItems) {
          var textEl = el.select('text'),
            yDim = textEl.attr('y'),
            xDim = textEl.attr('x'),
            triggerEl = el.append('g').attr({
              'class': 'collapsible-trigger'
            }),
            collapseListener = function() {
              helpers.collapseItem(item);
              helpers.addBodyItemsAndUpdateHeights();
            },
            expandListener = function() {
              helpers.expandItem(item);
              helpers.addBodyItemsAndUpdateHeights();
            },
            triggerTextEl = triggerEl.append('text').attr({
              y: Number(yDim) + 5,
              x: Number(xDim) - 20
            }),
            setCollapseTextAndListener = function() {
              triggerTextEl.text('-').attr('class', 'minus');
              triggerEl.on('click', collapseListener);
            },
            setExpandTextAndListener = function() {
              triggerTextEl.text('+').attr({
                'class': 'plus',
                y: yDim
              });
              triggerEl.on('click', expandListener);
            };

          if (_.isUndefined(item.collapsed)) {
            item.collapsed = false;
            setCollapseTextAndListener();
          } else {
            if (item.collapsed === true) setExpandTextAndListener();
            else if (item.collapsed === false) setCollapseTextAndListener();
          }
        }
      },
      addBodyItems = function(items, container, depth) {
        var newContainer, textG, textWidth, descriptionWidth, containerText;

        items = items || conf.body;
        container = container || bodyG;
        depth = depth || 1;

        if (items === conf.body) bodyPosition = 1;

        _.each(items, function(item, itemIndex) {
          var currentTextGId;

          currentTextGId = 'diagrams-box-text-' + textGId++;
          if (_.isString(item)) {
            item = helpers.generateItem(item);
            items[itemIndex] = item;
          }
          if (item.items.length > 0) {
            newContainer = container.append('g');
            containerText = item.text;
            if (item.items && item.items.length > 0) containerText += ':';
            if (item.description) {
              item.fullText = d.utils.generateATextDescriptionStr(containerText, item.description);
              containerText += ' (...)';
            } else {
              item.fullText = false;
            }
            textG = newContainer.append('text').text(containerText).attr({
              x: depthWidth * depth,
              y: rowHeight * ++bodyPosition,
              id: currentTextGId
            });
            // item.items = _.sortBy(item.items, 'text');
            addBodyItems(item.items, newContainer, depth + 1);
          } else {
            if (item.options && item.options.isLink === true) {
              newContainer = container.append('svg:a').attr("xlink:href", item.description)
              textG = newContainer.append('text').text(d.utils.formatShortDescription(item.text)).attr({
                id: currentTextGId,
                x: depthWidth * depth,
                y: rowHeight * ++bodyPosition,
                fill: '#3962B8'
              });

              item.fullText = item.text + ' (' + item.description + ')';
            } else {
              newContainer = container.append('g').attr({
                id: currentTextGId
              });
              textG = newContainer.append('text').text(d.utils.formatShortDescription(item.text)).attr({
                x: depthWidth * depth,
                y: rowHeight * ++bodyPosition
              }).style({
                'font-weight': 'bold'
              });
              if (item.description) {
                textWidth = textG[0][0].getBoundingClientRect().width;
                descriptionWidth = svg[0][0].getBoundingClientRect().width - textWidth - depthWidth * depth - 30;

                newContainer.append('text').text('- ' + d.utils.formatShortDescription(item.description)).attr({
                  x: depthWidth * depth + textWidth + 5,
                  y: rowHeight * bodyPosition - 1
                }).each(d.svg.textEllipsis(descriptionWidth));
              }

              item.fullText = d.utils.generateATextDescriptionStr(item.text, item.description);
            }
          }
          collapseIfNecessary(newContainer, item);
          item.textG = newContainer;

          diagram.addMouseListenersToEl(textG, item);
        });
      },
      bodyG, bodyPosition, bodyRect;

    helpers.addBodyItemsAndUpdateHeights = function() {
      var currentScroll = (window.pageYOffset || document.documentElement.scrollTop) - (document.documentElement.clientTop || 0);
      svg.attr('height', 10);
      if (bodyG) bodyG.remove();
      bodyG = boxG.append('g').attr({
        transform: 'translate(0, ' + nameHeight + ')'
      });
      bodyRect = bodyG.append('rect').attr({
        width: width,
        stroke: '#000',
        fill: '#fff'
      }).style({
        filter: 'url(#diagrams-drop-shadow-box)'
      });
      addBodyItems();
      d.svg.updateHeigthOfElWithOtherEl(svg, boxG, 50);
      d.svg.updateHeigthOfElWithOtherEl(bodyRect, boxG, 25 - nameHeight);

      window.scrollTo(0, currentScroll);
    };

    d.svg.addFilterColor('box', svg, 3, 4);

    nameG.append('rect').attr({
      height: nameHeight,
      width: width,
      stroke: '#000',
      fill: '#fff'
    }).style({
      filter: 'url(#diagrams-drop-shadow-box)'
    });
    nameG.append('text').attr({
      x: width / 2,
      y: 30
    }).text(conf.name).style({
      'font-weight': 'bold',
      'text-anchor': 'middle'
    });

    helpers.addBodyItemsAndUpdateHeights();
    helpers.addButtons(origConf, conf);
    diagram.setRelationships(conf.body);
  }

  setRelationships(items, container) {
    var diagram = this;
    _.each(items, function(item) {
      diagram.generateEmptyRelationships(item);
      if (container) {
        diagram.addDependantRelationship(container, item.textG, item);
        diagram.addDependencyRelationship(item, container.textG, container);
      }
      if (item.items && item.items.length > 0) diagram.setRelationships(item.items, item);
    });
  }
};

new Box({
  name: 'box',
  helpers: helpers
});
