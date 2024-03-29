% Generated by roxygen2: do not edit by hand
% Please edit documentation in R/visGetUtils.R
\name{visGetNodes}
\alias{visGetNodes}
\title{Function to get nodes data, with shiny only.}
\usage{
visGetNodes(graph, input = paste0(graph$id, "_nodes"), addCoordinates = T)
}
\arguments{
\item{graph}{: a \code{\link{visNetworkProxy}}  object}

\item{input}{: name of shiny input created. Default to paste0(graph$id, "_nodes")}

\item{addCoordinates}{: Boolean. Add coordinates to nodes data ? Default to TRUE.}
}
\description{
Function to get nodes data, with shiny only.
}
\examples{
\dontrun{

# have a look to : 
shiny::runApp(system.file("shiny", package = "visNetwork"))

}

}
\references{
See online documentation \url{https://datastorm-open.github.io/visNetwork/}
}
\seealso{
\link{visNodes} for nodes options, \link{visEdges} for edges options, \link{visGroups} for groups options, 
\link{visLegend} for adding legend, \link{visOptions} for custom option, \link{visLayout} & \link{visHierarchicalLayout} for layout, 
\link{visPhysics} for control physics, \link{visInteraction} for interaction, \link{visNetworkProxy} & \link{visFocus} & \link{visFit} for animation within shiny,
\link{visDocumentation}, \link{visEvents}, \link{visConfigure} ...
}
