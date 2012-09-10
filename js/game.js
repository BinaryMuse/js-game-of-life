// =============================================================================
// Game

function Game(rows, cols, iterationTime) {
  this.iterationTime = iterationTime;
  this.iterations = 0;
  this.grid = new Grid(rows, cols, this);

  this.state = StateMachine.create({
    initial: 'paused',
    events: [
      { name: 'play',  from: 'paused',  to: 'playing' },
      { name: 'pause', from: 'playing', to: 'paused'  },
      { name: 'reset', from: 'paused',  to: 'paused'  }
    ]
  });

  this.state.onchangestate = this.emit.bind(this, 'stateChange');

  this.state.onplaying = function() {
    this.emit('playing');
    this.tick();
  }.bind(this);

  this.state.onpaused = function() {
    this.emit('paused');
    if (this.timer) clearTimeout(this.timer);
  }.bind(this);

  this.state.onreset = function() {
    this.iterations = 0;
    this.emit('reset');
  }.bind(this);
};

Game.prototype = Object.create(EventEmitter2.prototype);

Game.prototype.tick = function() {
  this.emit('tick', ++this.iterations);
  if (this.is('playing')) {
    this.timer = setTimeout(function() {
      this.tick();
    }.bind(this), this.iterationTime);
  }
};

// Delegate common state machine methods to the state machine
['pause', 'play', 'reset', 'can', 'is'].forEach(function(event) {
  Game.prototype[event] = function() {
    return this.state[event].apply(this.state, arguments);
  };
});

// =============================================================================
// GamePresenter

function GamePresenter(selector, game) {
  this.view = $(selector);
  this.buttons = this.view.find('button');
  this.iterations = this.view.find('.iteration');

  this.game = game;

  this.gridPresenter = new GridPresenter(this.view.find('.grid'), game, game.grid);
  this.setButtonState();

  this.buttons.on('click', this.handleButtonClick.bind(this));
  this.game.on('stateChange', this.setButtonState.bind(this));
  this.game.on('tick', this.setIterationCount.bind(this));
  this.game.on('reset', this.resetIterationCount.bind(this));
};

GamePresenter.prototype.handleButtonClick = function(evt) {
  var event = $(evt.target).data('event');
  this.game[event].apply(this.game);
};

GamePresenter.prototype.setButtonState = function() {
  this.buttons.each(function(i, button) {
    var button = $(button);
    var event = button.data('event');
    if (this.game.can(event)) button.prop('disabled', false);
    else                      button.prop('disabled', true);
  }.bind(this));
};

GamePresenter.prototype.setIterationCount = function(count) {
  this.iterations.text(count);
};

GamePresenter.prototype.resetIterationCount = function() {
  this.setIterationCount(0);
};

// =============================================================================
// Grid

function Grid(rows, cols, game) {
  this.rows = rows;
  this.cols = cols;
  this.game = game;
  this.rules = new Rules(this);

  this.cells = {};
  for (var i = 1; i <= rows; i++) {
    this.cells[i] = {};
    for (var j = 1; j <= cols; j++) {
      this.cells[i][j] = new Cell(game, false);
    }
  };

  this.game.on('playing', this.visitLiveCells.bind(this));
  this.game.on('tick', this.processRules.bind(this));
  this.game.on('reset', this.clear.bind(this));
};

Grid.prototype.cell = function(row, col) {
  return this.cells[row][col];
};

Grid.prototype.visitLiveCells = function() {
  this.everyCell(function() {
    if (this.visited.can('visit')) this.visited.visit();
  });
};

Grid.prototype.processRules = function() {
  this.rules.transformations().forEach(function(fn) {
    fn();
  });
};

Grid.prototype.clear = function() {
  this.everyCell(function() {
    if (this.can('die')) this.die();
    if (this.visited.can('unvisit')) this.visited.unvisit();
  });
};

// Call `fn` for every cell on the grid. Inside the callback, `this` is
// the cell, and the callback receives as arguments the cell, row, and column.
//
// Example:
//
//     grid.everyCell(function(cell, row, column) {
//       this == cell;
//     });
Grid.prototype.everyCell = function(fn) {
  for (var i = 1; i <= this.rows; i++) {
    for (var j = 1; j <= this.cols; j++) {
      var cell = this.cell(i, j);
      fn.apply(cell, [cell, i, j]);
    }
  }
};

// Returns an array of the neighboring Cells to the Cell
// at the given row and column.
Grid.prototype.neighbors = function(row, column) {
  var leftColumn = column - 1;
  var rightColumn = column + 1;
  var upRow = row - 1;
  var downRow = row + 1;

  // Wrap around edges
  if (leftColumn < 1) leftColumn = this.cols;
  if (rightColumn > this.cols) rightColumn = 1;
  if (upRow < 1) upRow = this.rows;
  if (downRow > this.rows) downRow = 1;

  var neighbors = [];
  neighbors.push(this.cell(upRow, leftColumn));
  neighbors.push(this.cell(upRow, column));
  neighbors.push(this.cell(upRow, rightColumn));
  neighbors.push(this.cell(row, leftColumn));
  neighbors.push(this.cell(row, rightColumn));
  neighbors.push(this.cell(downRow, leftColumn));
  neighbors.push(this.cell(downRow, column));
  neighbors.push(this.cell(downRow, rightColumn));
  return neighbors;
};

// =============================================================================
// GridPresenter

function GridPresenter(view, game, grid) {
  for (var i = 1; i <= grid.rows; i++) {
    var row = $("<tr>");
    for (var j = 1; j <= grid.cols; j++) {
      var cellPresenter = new CellPresenter(game, grid.cell(i, j));
      row.append(cellPresenter.view);
    }
    view.append(row);
  }
};

// =============================================================================
// Cell

function Cell(game, alive) {
  this.game = game;

  this.state = StateMachine.create({
    initial: 'dead',
    events: [
      { name: 'live',   from: 'dead',  to: 'alive' },
      { name: 'die',    from: 'alive', to: 'dead'  },
      { name: 'toggle', from: 'dead',  to: 'alive' },
      { name: 'toggle', from: 'alive', to: 'dead'  }
    ]
  });

  this.state.onchangestate = this.emit.bind(this, 'stateChange');

  // A cell cannot be toggled unless the game is paused.
  this.state.onbeforetoggle = function() {
    if (!game.is('paused')) return false;
  };

  this.state.onalive = function() {
    if (this.visited.can('visit')) this.visited.visit();
  }.bind(this);

  this.visited = StateMachine.create({
    initial: 'unvisited',
    events: [
      { name: 'visit',   from: 'unvisited', to: 'visited' },
      { name: 'unvisit', from: 'visited',   to: 'unvisited' }
    ]
  });

  this.visited.onchangestate = this.emit.bind(this, 'visitedChange');

  this.visited.onbeforevisit = function() {
    if (!this.state.is('alive')) return false;
    if (this.game.is('paused')) return false;
  }.bind(this);
};

Cell.prototype = Object.create(EventEmitter2.prototype);

['live', 'die', 'toggle', 'can', 'is'].forEach(function(event) {
  Cell.prototype[event] = function() {
    return this.state[event].apply(this.state, arguments);
  };
});

// =============================================================================
// CellPresenter

function CellPresenter(game, cell) {
  this.game = game;
  this.cell = cell;
  this.render();
  this.cell.on('stateChange', this.render.bind(this));
  this.cell.on('visitedChange', this.render.bind(this));
  this.view.on('click', this.onClick.bind(this));
};

CellPresenter.prototype.render = function() {
  this.view = (this.view || $("<td>").addClass('cell'));

  if (this.cell.state.current == 'alive') {
    this.view.addClass('alive');
  } else {
    this.view.removeClass('alive');
  }

  if (this.cell.visited.current == 'visited') {
    this.view.addClass('visited');
  } else {
    this.view.removeClass('visited');
  }
};

CellPresenter.prototype.onClick = function() {
  this.cell.toggle();
};

// =============================================================================
// Rules

function Rules(grid) {
  this.grid = grid;
};

// Returns an array of functions that should be called
// in order to get the grid into the "next" state.
Rules.prototype.transformations = function() {
  var transformations = [];
  this.grid.everyCell(function(cell, row, column) {
    var neighbors = this.grid.neighbors(row, column);
    var alive = 0;
    var dead = 0;
    neighbors.forEach(function(c) {
      if (c.is('alive')) alive++;
      else               dead++;
    });

    if (cell.is('alive')) {
      if (alive < 2 || alive > 3) {
        transformations.push(function() { cell.die(); });
      }
    } else if (alive == 3) {
      transformations.push(function() { cell.live(); });
    }
  }.bind(this));
  return transformations;
};

// =============================================================================
// Setup

$(function() {
  var ROWS = 70;
  var COLS = 70;
  var INTERVAL = 15;

  var game = new Game(ROWS, COLS, INTERVAL);
  var gamePresenter = new GamePresenter("#game", game);
});
