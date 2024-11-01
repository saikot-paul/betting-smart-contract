import { NearBindgen, near, call, view, AccountId, initialize, assert, NearPromise } from 'near-sdk-js';
import { attachedDeposit } from 'near-sdk-js/lib/api';

class Game {
  homeOdds: number;
  awayOdds: number;
  pool: string; // Changed to string to store BigInt values
  status: "PENDING" | "COMPLETED" | "CANCELLED"

  constructor(homeOdds: number, awayOdds: number, pool: bigint, status: "PENDING" | "COMPLETED" | "CANCELLED") {
    this.homeOdds = homeOdds;
    this.awayOdds = awayOdds;
    this.pool = pool.toString(); // Convert BigInt to string
    this.status = status;
  }
}

class Bet {
  betAmount: string; // Changed to string to store BigInt values
  betSide: "HOME" | "AWAY"

  constructor(betAmount: bigint, betSide: "HOME" | "AWAY") {
    this.betAmount = betAmount.toString() // Convert BigInt to string
    this.betSide = betSide
  }
}

@NearBindgen({})
class BettingContract {
  betList: { [user: AccountId]: Bet } = {};
  gamesBet: { [gameID: string]: { [user: AccountId]: Bet } } = {};
  games: { [gameID: string]: Game } = {};

  @view({})
  get_games(): { [gameID: string]: Game } {
    return this.games
  }

  @call({ payableFunction: true })
  add_game({ gameID, homeOdds, awayOdds }: { gameID: string, homeOdds: number, awayOdds: number }) {
    assert(!this.games[gameID], `Game ${gameID} exists already`)

    const minimumDeposit = BigInt(1_000_000_000_000_000_000_000_000)
    const deposit = near.attachedDeposit()
    assert(deposit >= minimumDeposit, `You must attach at least 1 NEAR to add a game`);

    this.games[gameID] = new Game(
      homeOdds,
      awayOdds,
      deposit,
      "PENDING",
    )
  }

  @call({ payableFunction: true })
  place_bet({ betAmount, gameID, betSide }: { betAmount: string, gameID: string, betSide: "HOME" | "AWAY" }) {
    assert(this.games[gameID], 'Game does not exist')

    const minimumDeposit = BigInt(1_000_000_000_000_000_000_000_000)
    const deposit = near.attachedDeposit()
    assert(deposit >= minimumDeposit, `You must attach at least 1 NEAR to bet`);

    const bettor = near.predecessorAccountId()

    // Initialize the gamesBet[gameID] object if it doesn't exist
    if (!this.gamesBet[gameID]) {
      this.gamesBet[gameID] = {};
    }

    const bet = new Bet(
      BigInt(betAmount),
      betSide
    )

    this.gamesBet[gameID][bettor] = bet
    this.games[gameID].pool = (BigInt(this.games[gameID].pool) + deposit).toString()

    near.log(`Bet placed by ${bettor} on game ${gameID} for ${betSide} with amount ${deposit.toString()} yoctoNEAR, pool: ${this.games[gameID].pool}`);
  }
}