Game of Life in JavaScript
==========================

This is an implementation of [Conway's Game of Life][game-of-life] in JavaScript.
It is implemented using an [MVP architecture][mvp] and uses [state machines][state-machine]
for managing application state. (Instead of formal view objects, the application uses
Zepto.js wrapped elements as views.)

  [game-of-life]: http://en.wikipedia.org/wiki/Conway's_Game_of_Life
  [mvp]: http://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93presenter
  [state-machine]: http://en.wikipedia.org/wiki/Finite-state_machine

The application uses the following libraries:

  * [es5-shim](https://github.com/kriskowal/es5-shim)
  * [EventEmitter2](https://github.com/hij1nx/EventEmitter2)
  * [javascript-state-machine](https://github.com/jakesgordon/javascript-state-machine)
  * [Zepto.js](http://zeptojs.com/)

License
-------

This project is license under the MIT license:

> Copyright (c) 2012 Brandon Tilley
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is furnished
> to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
> FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
> IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
> CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
