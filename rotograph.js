// Force-directed layout: https://github.com/d3/d3-force
// Curved edges: https://bl.ocks.org/mbostock/4600693
// Updating: https://bl.ocks.org/mbostock/0adcc447925ffae87975a3a81628a196

// For cached data:
// f = {}; Object.keys(data).slice(0, 100).forEach((k)=>{f[k] = {dat: data[k].dat, name: data[k].name, port: data[k].port}}); copy(JSON.stringify(f, null, 2));

let selected;
window.data = {};

// Load data
const request = async () => {
  const response = await fetch('cached-graph.json');
  const json = await response.json();
  return json;
};

request().then(json => {
  window.data = json;
  updateGraph();
});

const svg = d3.select('svg');
const width = window.innerWidth;
svg.attr('width', width);
svg.on('click', svgClicked);
const height = +svg.attr('height');

let link = svg
  .append('g')
  .attr('class', 'links')
  .selectAll('.link');
let node = svg
  .append('g')
  .attr('class', 'nodes')
  .selectAll('.node');

const simulation = d3
  .forceSimulation()
  .force(
    'link',
    d3
      .forceLink()
      .distance(2)
      .strength(0.98)
  )
  .force('charge', d3.forceManyBody().strength(-25))
  .force('center', d3.forceCenter(width / 2, height / 2))
  // .force('collide', d3.forceCollide().radius(10))
  .alphaTarget(1)
  .on('tick', ticked);

// init/update data
function updateGraph() {
  let existingById;
  if (node) {
    existingById = d3.map(node.data(), function(d) {
      return d.id;
    });
  }

  const nodes = Object.keys(data)
    .map(key => {
      const {name, port} = data[key];
      const n = {
        id: key,
        name,
        port
      };
      if (existingById) {
        const existing = existingById.get(key);
        if (existing) {
          n.x = existing.x - width / 2;
          n.y = existing.y - height / 2;
          n.vx = existing.vx;
          n.vy = existing.vy;
        }
      }
      return n;
    })
    .filter(node => {
      // Include all
      if (!selected) return true;
      // Neighbors only
      return (
        selected.id === node.id ||
        selected.port.includes(node.id) ||
        node.port.includes(selected.id)
      );
    })
    // Quick & dirty way to keep it sane
    .slice(0, 120);

  const nodeById = d3.map(nodes, function(d) {
    return d.id;
  });
  const bilinks = [];
  const intermediateNodes = [];

  const links = nodes.reduce((edges, node, index, nodes) => {
    const {id, port} = node;
    port.forEach(portKey => {
      const source = nodeById.get(id);
      const target = nodeById.get(portKey);
      if (!source || !target) {
        return;
      }
      const intermediateNode = {};
      intermediateNodes.push(intermediateNode);
      edges.push({source, target: intermediateNode});
      edges.push({source: intermediateNode, target});
      bilinks.push([source, intermediateNode, target]);
    });
    return edges;
  }, []);

  const graph = {nodes, links};

  link = link.data(
    bilinks.filter(d => {
      if (!selected) return true;
      // filter to self and neighbors
      const source = d[0];
      const target = d[2];
      return (
        source.id === selected.id ||
        target.id === selected.id ||
        (source.port.includes(selected.id) && target.port.includes(selected.id))
      );
    }),
    d => d[0].id + ' → ' + d[2].id
  );

  link.exit().remove();

  link = link
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('stroke-width', 1)
    .attr('fill', 'none')
    .merge(link)
    .attr('stroke', d => {
      const source = d[0];
      const target = d[2];
      if (selected && source.id === selected.id) {
        return 'rgba(255,0,0,0.5)';
      }
      if (selected && target.id === selected.id) {
        return 'rgba(0,255,0,0.5)';
      }
      return 'rgba(0,0,0,0.1)';
    });

  node = node.data(nodes.filter(d => d.id), d => d.id);

  node
    .exit()
    .transition()
    .duration(750)
    .attr('r', 0)
    .remove();

  node = node
    .enter()
    .append('circle')
    .attr('class', 'node')
    .attr('r', 1)
    .attr('fill', 'rgba(255,255,255,0.1)')
    .on('click', nodeClicked)
    .call(node => {
      node
        .transition()
        .duration(1500)
        .attr('r', 10);
    })
    .call(node => {
      node.append('title').text(d => d.name);
    })
    .call(
      d3
        .drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
    )
    .merge(node)
    .attr('stroke-width', d => {
      return selected && d.id === selected.id ? 1.5 : 1;
    })
    .attr('stroke', d => {
      return selected && d.id === selected.id ? 'black' : 'rgba(0,0,0,0.5)';
    });

  simulation.nodes(graph.nodes.concat(intermediateNodes));
  simulation.force('link').links(graph.links);
  simulation.alphaTarget(0.3).restart();
}

function ticked() {
  link.attr('d', positionLink);
  node.attr('transform', positionNode);
}

function twoPlaces(number) {
  return Math.round(number * 100) / 100;
}

function positionLink(d) {
  const [s, i, t] = d;
  return `M ${twoPlaces(s.x)},${twoPlaces(s.y)} S ${twoPlaces(i.x)},${twoPlaces(
    i.y
  )} ${twoPlaces(t.x)},${twoPlaces(t.y)}`;
}

function positionNode(d) {
  return `translate( ${twoPlaces(d.x)},${twoPlaces(d.y)})`;
}

function svgClicked() {
  selected = null;
  updateGraph();
}

function nodeClicked(s) {
  d3.event.stopPropagation();
  selected = s;
  focusUser(s.id);
  updateGraph();
}

function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}
