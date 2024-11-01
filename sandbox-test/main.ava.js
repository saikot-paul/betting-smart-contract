import anyTest from 'ava';
import { Worker, NEAR } from 'near-workspaces';
import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

const test = anyTest;

test.beforeEach(async t => {
  const worker = t.context.worker = await Worker.init();
  const root = worker.rootAccount;
  const contract = await root.createSubAccount('betting-contract');
  await contract.deploy(process.argv[2]);
  t.context.accounts = { root, contract };
});

test.afterEach.always(async (t) => {
  await t.context.worker.tearDown().catch((error) => {
    console.log('Failed to stop the Sandbox:', error);
  });
});

test('tracks pool correctly with multiple bets', async (t) => {
  const { root, contract } = t.context.accounts;
  const gameID = "game1";

  // Create additional test accounts
  const alice = await root.createSubAccount('alice');
  const bob = await root.createSubAccount('bob');
  const carol = await root.createSubAccount('carol');

  // First add a game
  console.log('Adding game...');
  await root.call(
    contract,
    'add_game',
    { gameID, homeOdds: 150, awayOdds: 250 },
    { attachedDeposit: NEAR.parse('1') }
  );

  const initialGames = await contract.view('get_games', {});
  console.log('Initial pool:', initialGames[gameID].pool);
  t.is(initialGames[gameID].pool, NEAR.parse('1').toString());

  // Place bet from Alice
  console.log('\nAlice placing bet...');
  await alice.call(
    contract,
    'place_bet',
    {
      gameID,
      betAmount: NEAR.parse('2').toString(),
      betSide: "HOME"
    },
    { attachedDeposit: NEAR.parse('2') }
  );

  const gamesAfterAlice = await contract.view('get_games', {});
  console.log('Pool after Alice\'s bet:', gamesAfterAlice[gameID].pool);
  t.is(gamesAfterAlice[gameID].pool, NEAR.parse('3').toString()); // Initial 1 + Alice's 2

  // Place bet from Bob
  console.log('\nBob placing bet...');
  await bob.call(
    contract,
    'place_bet',
    {
      gameID,
      betAmount: NEAR.parse('3').toString(),
      betSide: "AWAY"
    },
    { attachedDeposit: NEAR.parse('3') }
  );

  const gamesAfterBob = await contract.view('get_games', {});
  console.log('Pool after Bob\'s bet:', gamesAfterBob[gameID].pool);
  t.is(gamesAfterBob[gameID].pool, NEAR.parse('6').toString()); // Previous 3 + Bob's 3

  // Place bet from Carol
  console.log('\nCarol placing bet...');
  await carol.call(
    contract,
    'place_bet',
    {
      gameID,
      betAmount: NEAR.parse('4').toString(),
      betSide: "HOME"
    },
    { attachedDeposit: NEAR.parse('4') }
  );

  const finalGames = await contract.view('get_games', {});
  console.log('Final pool after Carol\'s bet:', finalGames[gameID].pool);
  t.is(finalGames[gameID].pool, NEAR.parse('10').toString()); // Previous 6 + Carol's 4



});


test('adds a new game successfully', async (t) => {
  const { root, contract } = t.context.accounts;
  const gameID = "game1";
  const homeOdds = 150; // 1.5x odds
  const awayOdds = 250; // 2.5x odds

  await root.call(
    contract,
    'add_game',
    { gameID, homeOdds, awayOdds },
    { attachedDeposit: NEAR.parse('1') }
  );

  const games = await contract.view('get_games', {});
  t.truthy(games[gameID]);
  t.is(games[gameID].status, "PENDING");
  t.is(games[gameID].homeOdds, homeOdds);
  t.is(games[gameID].awayOdds, awayOdds);
});

test('fails to add game with insufficient deposit', async (t) => {
  const { root, contract } = t.context.accounts;
  const gameID = "game1";

  const error = await t.throwsAsync(
    root.call(
      contract,
      'add_game',
      { gameID, homeOdds: 150, awayOdds: 250 },
      { attachedDeposit: NEAR.parse('0.1') }
    )
  );

  t.regex(error.message, /You must attach at least 1 NEAR/);
});


test('places bet successfully', async (t) => {
  const { root, contract } = t.context.accounts;
  const gameID = "game1";

  // First add a game
  await root.call(
    contract,
    'add_game',
    { gameID, homeOdds: 150, awayOdds: 250 },
    { attachedDeposit: NEAR.parse('1') }
  );

  // Then place a bet
  await root.call(
    contract,
    'place_bet',
    {
      gameID,
      betAmount: NEAR.parse('1').toString(),
      betSide: "HOME"
    },
    { attachedDeposit: NEAR.parse('1') }
  );

  const games = await contract.view('get_games', {});
  t.is(games[gameID].pool, NEAR.parse('2').toString()); // Initial 1 NEAR + 1 NEAR bet
});

test('fails to bet on non-existent game', async (t) => {
  const { root, contract } = t.context.accounts;

  const error = await t.throwsAsync(
    root.call(
      contract,
      'place_bet',
      {
        gameID: "nonexistent",
        betAmount: NEAR.parse('1').toString(),
        betSide: "HOME"
      },
      { attachedDeposit: NEAR.parse('1') }
    )
  );

  t.regex(error.message, /Game does not exist/);
});

test('fails to bet with insufficient deposit', async (t) => {
  const { root, contract } = t.context.accounts;
  const gameID = "game1";

  // First add a game
  await root.call(
    contract,
    'add_game',
    { gameID, homeOdds: 150, awayOdds: 250 },
    { attachedDeposit: NEAR.parse('1') }
  );

  const error = await t.throwsAsync(
    root.call(
      contract,
      'place_bet',
      {
        gameID,
        betAmount: NEAR.parse('1').toString(),
        betSide: "HOME"
      },
      { attachedDeposit: NEAR.parse('0.1') }
    )
  );

  t.regex(error.message, /You must attach at least 1 NEAR/);
});