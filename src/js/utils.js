// This file is always concatenated at the beginning of the library.
// Maybe it would be worth to separate public and private utils (relatively to the external clients)

d.utils = {};
d.utils.d3DefaultReturnFn = function(props, preffix, suffix) {
  props = props.split('.');
  return function(d) {
    var position = _.reduce(props, function(memo, property) {
      return memo[property];
    }, d);
    return (preffix || suffix) ? preffix + position + suffix : position;
  };
};
d.utils.applySimpleTransform = function(el) {
  el.attr('transform', function(d) {
    return "translate(" + d.x + "," + d.y + ")";
  });
};
d.utils.positionFn = function(props, offset) {
  offset = offset || 0;
  return d.utils.d3DefaultReturnFn(props, 0, offset);
};
d.utils.textFn = function(props, preffix, suffix) {
  preffix = preffix || '';
  suffix = suffix || '';
  return d.utils.d3DefaultReturnFn(props, preffix, suffix);
};
d.utils.runIfReady = function(fn) {
  if (document.readyState === 'complete') fn();
  else window.onload = fn;
};
d.utils.replaceCodeFragmentOfText = function(text, predicate) {
  var codeRegex = /``([\s\S]*?)``([\s\S]*?)``/g,
    allMatches = text.match(codeRegex);

  return text.replace(codeRegex, function(matchStr, language, codeBlock) {
    return predicate(matchStr, language, codeBlock, allMatches);
  });
};
d.utils.formatTextFragment = function(text) {
  var tagsToEncode = ['strong', 'code', 'pre', 'br', 'span', 'p'],
    encodeOrDecodeTags = function(action, tag) {
      var encodeOrDecodeTagsWithAction = _.partial(encodeOrDecodeTags, action),
        beginningTagArr = ['<' + tag + '(.*?)>', '<' + tag + '$1>', tag + 'DIAGSA(.*?)DIAGSB' + tag + 'DIAGSC', tag + 'DIAGSA$1DIAGSB' + tag + 'DIAGSC'],
        endingTagReal = '</' + tag + '>',
        endingTagFake = tag + 'ENDREPLACEDDIAGRAMS',
        endingTagArr = [endingTagReal, endingTagReal, endingTagFake, endingTagFake],
        replaceText = function(from, to) {
          text = text.replace(new RegExp(from, 'g'), to);
        };

      if (_.isArray(tag)) _.each(tag, encodeOrDecodeTagsWithAction);
      else {
        _.each([beginningTagArr, endingTagArr], function(arr) {
          if (action === 'encode') replaceText(arr[0], arr[3]);
          else if (action === 'decode') replaceText(arr[2], arr[1]);
        });
      }
    };
  text = d.utils.replaceCodeFragmentOfText(text, function(matchStr, language, code, allMatches) {
    var lastMatch = (matchStr === _.last(allMatches));
    return '<pre' + (lastMatch ? ' class="last-code-block" ' : '') + '><code>' + hljs.highlight(language, code).value + '</pre></code>';
  });

  encodeOrDecodeTags('encode', tagsToEncode);
  text = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  encodeOrDecodeTags('decode', tagsToEncode);

  return text;
};
d.utils.codeBlockOfLanguageFn = function(language, commentsSymbol) {
  commentsSymbol = commentsSymbol || '';
  return function(codeBlock, where, withInlineStrs) {
    if (withInlineStrs === true) codeBlock = commentsSymbol + " ...\n" + codeBlock + "\n" + commentsSymbol + " ...";
    if (_.isString(where)) codeBlock = commentsSymbol + ' @' + where + "\n" + codeBlock;
    return '``' + language + '``' + codeBlock + '``';
  };
};
// This function is created to be able to reference it in the diagrams
d.utils.wrapInParagraph = function(text) {
  return '<p>' + text + '</p>';
};

d.utils.composeWithEventEmitter = function(constructor) {
  var _subjects = [],
    createName = function(name) {
      return '$' + name;
    };

  constructor.prototype.emit = function(name, data) {
    var fnName = createName(name);
    _subjects[fnName] || (_subjects[fnName] = new Rx.Subject());
    _subjects[fnName].onNext(data);
  };

  constructor.prototype.listen = function(name, handler) {
    var fnName = createName(name);
    _subjects[fnName] || (_subjects[fnName] = new Rx.Subject());
    return _subjects[fnName].subscribe(handler);
  };

  constructor.prototype.dispose = function() {
    var subjects = _subjects;
    for (var prop in subjects) {
      if ({}.hasOwnProperty.call(subjects, prop)) {
        subjects[prop].dispose();
      }
    }

    _subjects = {};
  };
};

d.utils.createAnEventEmitter = function() {
  var constructor = function EventEmitter() {};

  d.utils.composeWithEventEmitter(constructor);

  return new constructor();
};

d.utils.generateATextDescriptionStr = function(text, description) {
  return '<strong>' + text + '</strong>' + (description ? '<br>' + description : '');
};

d.utils.formatShortDescription = function(text) {
  text = text.replace(/<p>/g, '');
  text = text.replace(/<br>/g, ' ');
  text = text.replace(/<\/p>/g, '. ');
  text = d.utils.replaceCodeFragmentOfText(text, function(matchStr, language, codeBlock) {
    if (matchStr === text && /\n/.test(matchStr) === false) return codeBlock;
    else return ' <CODE...>';
  });
  return text;
};

d.utils.dataFromGeneralToSpecificForATreeStructureType = function(generalData) {
  // FPN: Find Parent Node
  var FPNRecursiveFailed = false,
    itemsIdToItemsMap = {},
    nodesData = {},
    findParentNodeFn = function() {
      var itemsChecked,
        itemsIdToFromConnectionMap = {},
        FPNRecursiveFn = function(item) {
          var connection, parentItemId, parentItem;
          if (itemsChecked.indexOf(item) > -1) {
            FPNRecursiveFailed = true;
            return;
          } else itemsChecked.push(item);
          if (_.isUndefined(itemsIdToFromConnectionMap[item.id]) === false) {
            connection = itemsIdToFromConnectionMap[item.id];
          } else {
            connection = _.where(generalData.connections, {
              from: item.id
            });
            itemsIdToFromConnectionMap[item.id] = connection;
          }

          if (connection.length === 0) {
            if (parentNode) {
              if (parentNode.id !== item.id) FPNRecursiveFailed = true;
            } else parentNode = item;
          } else if (connection.length === 1) {
            parentItemId = connection[0].to;
            if (_.isUndefined(itemsIdToItemsMap[parentItemId]) === false) {
              parentItem = itemsIdToItemsMap[parentItemId];
            } else {
              parentItem = _.where(generalData.items, {
                id: parentItemId
              })[0];
              itemsIdToItemsMap[parentItemId] = parentItem;
            }
            FPNRecursiveFn(parentItem);
          } else FPNRecursiveFailed = true;
        };

      _.each(generalData.items, function(item) {
        if (FPNRecursiveFailed === false) {
          itemsChecked = [];
          itemsIdToItemsMap[item.id] = item;
          FPNRecursiveFn(item);
        }
      });
    },
    buildNodesDataRecursiveFn = function(transformedData, item) {
      var text, children;

      transformedData.id = item.id;
      text = item.name;
      if (item.description) text += ': ' + item.description;
      transformedData.text = text;

      children = _.where(generalData.connections, {
        to: item.id
      });
      if (children.length > 0) {
        transformedData.items = [];
        _.each(children, function(child) {
          transformedData.items.push({});
          buildNodesDataRecursiveFn(_.last(transformedData.items), itemsIdToItemsMap[child.from]);
        });
      }
    },
    parentNode;

  findParentNodeFn();
  if (FPNRecursiveFailed) {
    alert('The data structure is not suitable for this diagram')
    return [];
  } else {
    buildNodesDataRecursiveFn(nodesData, parentNode);
    return nodesData;
  }
};
