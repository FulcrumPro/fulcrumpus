const ROOMS         = 20,
      ROOMS_TUNNELS = 3,
      BATS          = 2,
      PITS          = 2,
      ARROWS        = 5,

      HELP = `
Welcome to "Hunt the Wumpus"
The wumpus lives in a cave of 20 rooms. Each room has 3 tunnels to
other rooms. (Look at a dodecahedron to see how this works. If you
dont know what a dodecahedron is, ask someone.)
Hazards:
 Bottomless pits - Two rooms have bottomless pits in them. If you go
   there, you fall into the pit (& lose)!
 Super bats - Two other rooms have super bats. If you go there, a
   bat grabs you and takes you to some other room at random (which
   may be troublesome).
Wumpus:
   The wumpus is not bothered by hazards. (He has sucker feet and is
   too big for a bat to lift.)  Usually he is asleep. Two things
   wake him up: your shooting an arrow, or your entering his room.
   If the wumpus wakes, he moves one room or stays still.
   After that, if he is where you are, he eats you up and you lose!
You:
   Each turn you may move or shoot a crooked arrow.
   Moving:  You can move one room (through one tunnel).
   Arrows:  You have 5 arrows.  You lose when you run out.
      You can only shoot to nearby rooms.
      If the arrow hits the wumpus, you win.
Warnings:
   When you are one room away from a wumpus or hazard, the computer
   says:
   Wumpus:  "You smell something terrible nearby."
   Bat   :  "You hear a rustling."
   Pit   :  "You feel a cold wind blowing from a nearby cavern."
-----------------------
`;


///////////////////
// LODASH IMPORT //
///////////////////

// import all lodash functions to the main namespace, but isNaN not to cause conflicts
_.each(_.keys(_), k => window[k === 'isNaN' ? '_isNaN' : k] = _[k]);

///////////
// WORLD //
///////////

// create a cave of 20 interconnected rooms. each room is linked to 3 other rooms
const cave = chain(range(ROOMS))
              .map(n => [n, [], []])
              .reduce((acc, n, idx, lst) => {
                acc = acc || lst;

                // possible candidates: not self; not already linked to the current room;
                //   not already having three tunnels
                const candidates = reject(acc, nn => first(nn) === first(n)
                        || includes(nn[1], first(n))
                        || includes(n[1], first(nn))
                        || nn[1].length === ROOMS_TUNNELS);

                let chosen = sampleSize(candidates, ROOMS_TUNNELS - n[1].length);

                each(chosen, c => {
                  n[1].push(first(c));
                  c[1].push(first(n));
                })

                return acc;
              }, null)
              .thru(c => {
                const findEmptyAndAdd = (element) => sample(filter(c, r => isEmpty(r[2])))[2] = [element];

                findEmptyAndAdd('wumpus');
                times(BATS, partial(findEmptyAndAdd, 'bat'));
                times(PITS, partial(findEmptyAndAdd, 'pit'));

                return c;
              })
              .value();

let world = {
  cave: cave,
  player: {
    room:  sample(filter(cave, r => isEmpty(r[2]))),
    arrows: ARROWS
  }
};

// graphviz visualization:
// const graphvizString = 'graph {\n' + map(cave, n => `    ${ first(n) } -- {${ n[1].join(', ') }};`).join('\n') + '\n}';
var xy = 'T1';
/////////////
// HELPERS //
/////////////

function isNearby(world, element) {
  return chain(world.player.room[1])
          .map(r => {
            return find(world.cave, rr => first(rr) === r)
          })
          .some(r => includes(r[2], element))
          .value();
}

function isInRoom (world, element, room) {
  room = room || world.player.room;
  return includes(room[2], element);
}

function roomIsNearby(world, roomId) {
  return includes(world.player.room[1].concat(first(world.player.room)), roomId);
}

function roomById (world, roomId) {
  return find(world.cave, r => first(r) === roomId);
}

function randomEmptyRoom(world) {
  return sample(filter(world.cave, r => isEmpty(r[2])));
}

var xx = 'lO';
///////////////////////
// WORLD INTERACTION //
///////////////////////

function describeCurrentRoom(world) {
  const pit    = isNearby(world, 'pit')    ? '\nYou feel a cold wind blowing from a nearby cavern.' : '',
        wumpus = isNearby(world, 'wumpus') ? '\nYou smell something terrible nearby.' : '',
        bat    = isNearby(world, 'bat')    ? '\nYou hear a rustling.' : '';

  return `You are in room ${ first(world.player.room) }
Exits go to: ${ world.player.room[1].join(', ') }${ pit }${ wumpus }${ bat }`;
}

let func;

function printlog(message) {
  message = message.split('\n');
  for (let m of message) {
    var div = document.createElement('div');
  
    div.append(m);
    document.getElementById('output').append(div);
  }
 
}

var yx = 'JJ';
function processInput (world, input) {

  function validateRoom() {
    let roomId;
    if (!_isNaN(roomId = parseInt(input, 10)) && roomId < ROOMS && roomIsNearby(world, roomId)) {
      return roomById(world, roomId);
    }
  }

  // quit
  if (processInput.awaiting === 'quit') {
    if (input !== 'y' && input !== 'n') {
      printlog("That doesn't make any sense");
    } else {
      if (input === 'y') {
        printlog('Goodbye, braveheart!');
        return die();
      } else {
        printlog('Good. the Wumpus is looking for you!');
      }
    }

    processInput.awaiting = null;
    return world;
  }

  if (input === 'q') {
    printlog("Are you so easily scared? [y/n]");
    processInput.awaiting = 'quit';
    return world;
  }

  // move
  if (processInput.awaiting === 'move') {
    let room;

    if (!(room = validateRoom())) {
      printlog('There are no tunnels from here to that room');
    } else {
      world.player.room = room;
      if (isInRoom(world, 'wumpus')) {
        printlog('The wumpus ate you up!\nGAME OVER');
        return die();
      }
      if (isInRoom(world, 'pit')) {
        printlog('You fall into a bottomless pit!\nGAME OVER');
        return die();
      }
      if (isInRoom(world, 'bat')) {
        world.player.room = randomEmptyRoom(world);
        printlog('The bats whisk you away!');
      }

      printlog(describeCurrentRoom(world));
    }
    printlog('What do you want to do? (m)ove or (s)hoot?');

    processInput.awaiting = null;
    return world;
  }

  if (input === 'm') {
    processInput.awaiting = 'move';
    printlog('Where?');
    return world;
  }

  // shoot
  if (processInput.awaiting === 'shoot') {
    let room;

    if (!(room = validateRoom())) {
      printlog('There are no tunnels from here to that room');
    } else {
      if (isInRoom(world, 'wumpus', room)) {
        printlog("YOU KILLED THE WUMPUS! GOOD JOB, BUDDY!!!");
        // GTFO! 
        // :taco: if you own up to trying to cheat
        printlog("Your code is: " + func(xy + yx + yy + xx));
        return die(true);
        
      } else {
        if (random(3) > 0) {
          let newWumpusRoom = randomEmptyRoom(world);

          find(world.cave, partial(isInRoom, world, 'wumpus'))[2] = [];
          newWumpusRoom[2] = ['wumpus'];

          if (isEqual(world.player.room, newWumpusRoom)) {
            printlog('You woke up the wumpus and he ate you!\nGAME OVER');
            return die();
          } else {
            printlog('Your arrow flew into the darkness.')
            printlog('You heard a rumbling in a nearby cavern.');
          }
        }
      }
    }

    world.player.arrows--;
    if (world.player.arrows === 0) {
      printlog('You ran out of arrows.\nGAME OVER');
      return die();
    }

    processInput.awaiting = null;
    return world;
  }

  if (input === 's') {
    processInput.awaiting = 'shoot';
    printlog('Where?');
    return world;
  }

  if (input === 'h') {
    printlog(HELP);
    return world;
  }

  printlog("That doesn't make any sense");
  return world;
}
processInput.awaiting = 'move';

var yy = 'R0';
///////////////
// MAIN LOOP //
///////////////

for (party of 'abcdefghijklmnopqrstuvwxyz'.split('')) {
  for (people of 'abcdefghijklmnopqrstuvwxyz'.split('')) {
    if (window[party + 'to' + people] && party < people) {
      func = window[party + 'to' + people];
    }
  }
}

function onSubmit() {
  var input = document.getElementById('input');
  var value = input.value;
  input.value = '';
  processInput(world, trim(value.toLowerCase()));
  printlog('-----------------------');
  window.scrollTo(0, document.body.scrollHeight);
}

function die(peacefully) {
  document.getElementById('inputarea').hidden = true;
  document.getElementById('gameover').hidden = false;
  processInput.awaiting = 'dead';
}

printlog(HELP);




// trigger the initial input. since processInput.awaiting is set to "move",
//  sending the room where the player is will actually trigger the
//  description of the room
processInput(world, first(world.player.room))
