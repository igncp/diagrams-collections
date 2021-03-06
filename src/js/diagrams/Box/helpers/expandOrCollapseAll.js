import { curry } from "ramda"

import traverseBodyDataAndRefresh from './traverseBodyDataAndRefresh'
import collapseItem from './collapseItem'
import expandItem from './expandItem'

const methods = {
  collapseItem,
  expandItem,
}

const traverseBodyOpts = { withCollapsedItems: true }

const itemCanBeCollapsedOrExpanded = item => item.hasOwnProperty('collapsed')

const expandOrCollapseItem = curry((collapseOrExpand, item) => {
  if (itemCanBeCollapsedOrExpanded(item)) {
    methods[`${collapseOrExpand}Item`](item)
  }
})

export default (creationId, collapseOrExpand) => {
  traverseBodyDataAndRefresh(
    creationId,
    traverseBodyOpts,
    expandOrCollapseItem(collapseOrExpand)
  )
}
