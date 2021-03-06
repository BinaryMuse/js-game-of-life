// =============================================================================
// Game

function Game(rows, cols, iterationTime) {
  this.iterationTime = iterationTime;
  this.iterations = 0;
  this.grid = new Grid(rows, cols, this);
  this.db = new GridDB(this.grid);

  this.state = StateMachine.create({
    initial: 'paused',
    events: [
      { name: 'play',  from: 'paused',  to: 'playing' },
      { name: 'pause', from: 'playing', to: 'paused'  },
      { name: 'reset', from: 'paused',  to: 'paused'  },
      { name: 'load',  from: 'paused',  to: 'paused'  },
      { name: 'save',  from: 'paused',  to: 'paused'  }
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

  this.state.onload = function() {
    this.emit('loading');
  }.bind(this);

  this.state.onsave = function() {
    this.emit('saving');
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

Game.prototype.saveToDb = function(name) {
  this.db.save(name);
  this.emit('saved', name);
};

Game.prototype.loadFromDb = function(name) {
  var data = this.db.load(name);
  this.loadFromJson(data);
};

Game.prototype.loadFromJson = function(data) {
  this.reset();
  for (var i in data) {
    for (var j in data[i]) {
      var cell = this.grid.cell(i, j);
      if (cell) cell.toggle();
    }
  }
};

Game.prototype.availableSaves = function() {
  return this.db.keys();
};

// Delegate common state machine methods to the state machine
['pause', 'play', 'reset', 'save', 'load', 'can', 'is'].forEach(function(event) {
  Game.prototype[event] = function() {
    return this.state[event].apply(this.state, arguments);
  };
});

// =============================================================================
// GamePresenter

function GamePresenter(selector, game) {
  this.view = $(selector);
  this.buttons = this.view.find('button[data-event]');
  this.selector = this.view.find('select');
  this.iterations = this.view.find('.iteration');

  this.game = game;

  this.gridPresenter = new GridPresenter(this.view.find('.grid'), game, game.grid);
  this.setButtonState();
  this.setSavedBoards();

  this.buttons.on('click', this.handleButtonClick.bind(this));
  this.game.on('stateChange', this.setButtonState.bind(this));
  this.game.on('tick', this.setIterationCount.bind(this));
  this.game.on('reset', this.resetIterationCount.bind(this));
  this.game.on('saving', this.save.bind(this));
  this.game.on('loading', this.load.bind(this));
  this.game.on('saved', function(name) {
    this.addSaveBoard(name, true);
  }.bind(this));
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

GamePresenter.prototype.setSavedBoards = function() {
  this.game.availableSaves().forEach(function(name) {
    this.addSaveBoard(name);
  }.bind(this));
};

GamePresenter.prototype.setIterationCount = function(count) {
  this.iterations.text(count);
};

GamePresenter.prototype.resetIterationCount = function() {
  this.setIterationCount(0);
};

GamePresenter.prototype.save = function() {
  var name = "";
  while (name.trim() == "") {
    name = prompt("What do you want to name your save?", "");
    if (name == null) return;
  }
  this.game.saveToDb(name.trim());
};

GamePresenter.prototype.load = function() {
  var name = this.selector.val();
  if (name == "") return;
  this.game.loadFromDb(name);
};

GamePresenter.prototype.addSaveBoard = function(name, select) {
  $("<option>").text(name).val(name).appendTo(this.selector);
  if (select) this.selector.val(name);
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
      this.cells[i][j] = new Cell(game, i, j, false);
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
  this.grid = grid;
  this.game = game;
  this.view = view;
  this.context = this.view.get(0).getContext('2d');
  this.context.translate(0.5, 0.5); // get sharp lines
  this.context.fillStyle = '#FFF';
  this.context.save();
  this.cellPresenters = {};

  for (var i = 1; i <= grid.rows; i++) {
    this.cellPresenters[i] = (this.cellPresenters[i] || {});
    for (var j = 1; j <= grid.cols; j++) {
      var cellPresenter = new CellPresenter(game, grid.cell(i, j), this.context);
      this.cellPresenters[i][j] = cellPresenter;
    }
  }

  this.view.on('click', this.onClick.bind(this));
};

GridPresenter.prototype.onClick = function(evt) {
  var row = Math.floor(evt.offsetY / 10) + 1;
  var column = Math.floor(evt.offsetX / 10) + 1;
  var presenter = this.cellPresenters[row][column];
  presenter.onClick();
};

// =============================================================================
// Cell

function Cell(game, row, column, alive) {
  this.game = game;
  this.row = row;
  this.column = column;

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

function CellPresenter(game, cell, context) {
  this.game = game;
  this.cell = cell;
  this.context = context;
  this.render();
  this.cell.on('stateChange', this.render.bind(this));
  this.cell.on('visitedChange', this.render.bind(this));
};

CellPresenter.prototype.render = function() {
  var x = 10 * this.cell.column - 10;
  var y = 10 * this.cell.row - 10;
  this.context.save();
  this.context.strokeStyle = '#000';
  this.context.clearRect(x, y, 10, 10);

  if (this.cell.state.current == 'dead') {
    if (this.cell.visited.current == 'visited') {
      this.context.fillStyle = '#3F9';
    }
  } else {
    this.context.fillStyle = '#000';
  }
  this.context.fillRect(x, y, 10, 10);
  this.context.strokeRect(x, y, 10, 10);
  this.context.restore();
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
// GridDB

function GridDB(grid) {
  this.grid = grid;
};

GridDB.prototype = Object.create(EventEmitter2.prototype)

GridDB.prototype.save = function(key) {
  var data = {};
  this.grid.everyCell(function(cell, row, col) {
    if (cell.is('alive')) {
      data[row] = (data[row] || {});
      data[row][col] = 1;
    }
  });
  localStorage['gol:' + key] = JSON.stringify(data);
};

GridDB.prototype.load = function(key) {
  var data = localStorage['gol:' + key];
  if (data) {
    data = JSON.parse(data);
  }
  return data;
};

GridDB.prototype.keys = function() {
  var keys = [];
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key.match(/^gol:/)) keys.push(key.replace('gol:', ''));
  }
  return keys;
};

// =============================================================================
// Setup

$(function() {
  var ROWS = 60;
  var COLS = 60;
  var INTERVAL = 15;

  var data = '{"12":{"45":1},"13":{"47":1},"14":{"44":1,"45":1,"48":1,"49":1,"50":1},"43":{"15":1},"44":{"17":1},"45":{"14":1,"15":1,"18":1,"19":1,"20":1}}'
  var game = new Game(ROWS, COLS, INTERVAL);
  var gamePresenter = new GamePresenter("#game", game);
  game.loadFromJson(JSON.parse(data));
});
