// --- Minimal ERC20 ABI ---
export const ERC20_ABI = [
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { name: 'symbol',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  {
    name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{name:'owner',type:'address'},{name:'spender',type:'address'}],
    outputs: [{ name:'', type:'uint256'}]
  },
  {
    name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{name:'spender',type:'address'},{name:'amount',type:'uint256'}],
    outputs: [{ name:'', type:'bool'}]
  }
] as const;

// --- Minimal WETH ABI (deposit/withdraw/balanceOf) ---
export const WETH_ABI = [
  { name:'deposit',  type:'function', stateMutability:'payable', inputs:[], outputs:[] },
  { name:'withdraw', type:'function', stateMutability:'nonpayable', inputs:[{name:'wad', type:'uint256'}], outputs:[] },
  { name:'balanceOf', type:'function', stateMutability:'view', inputs:[{name:'who',type:'address'}], outputs:[{name:'',type:'uint256'}] }
] as const;

// --- NonfungiblePositionManager (subset) ---
export const NFPM_ABI = [
  {
    name:'mint', type:'function', stateMutability:'nonpayable',
    inputs:[{name:'params',type:'tuple',components:[
      {name:'token0',type:'address'},
      {name:'token1',type:'address'},
      {name:'fee',type:'uint24'},
      {name:'tickLower',type:'int24'},
      {name:'tickUpper',type:'int24'},
      {name:'amount0Desired',type:'uint256'},
      {name:'amount1Desired',type:'uint256'},
      {name:'amount0Min',type:'uint256'},
      {name:'amount1Min',type:'uint256'},
      {name:'recipient',type:'address'},
      {name:'deadline',type:'uint256'}
    ]}],
    outputs:[{name:'tokenId',type:'uint256'},{name:'liquidity',type:'uint128'},{name:'amount0',type:'uint256'},{name:'amount1',type:'uint256'}]
  },
  {
    name:'decreaseLiquidity', type:'function', stateMutability:'nonpayable',
    inputs:[{name:'params',type:'tuple',components:[
      {name:'tokenId',type:'uint256'},
      {name:'liquidity',type:'uint128'},
      {name:'amount0Min',type:'uint256'},
      {name:'amount1Min',type:'uint256'},
      {name:'deadline',type:'uint256'}
    ]}],
    outputs:[]
  },
  {
    name:'collect', type:'function', stateMutability:'nonpayable',
    inputs:[{name:'params',type:'tuple',components:[
      {name:'tokenId',type:'uint256'},
      {name:'recipient',type:'address'},
      {name:'amount0Max',type:'uint128'},
      {name:'amount1Max',type:'uint128'}
    ]}],
    outputs:[{name:'amount0',type:'uint256'},{name:'amount1',type:'uint256'}]
  },
  {
    name:'positions', type:'function', stateMutability:'view',
    inputs:[{name:'tokenId',type:'uint256'}],
    outputs:[
      {name:'nonce',type:'uint96'},
      {name:'operator',type:'address'},
      {name:'token0',type:'address'},
      {name:'token1',type:'address'},
      {name:'fee',type:'uint24'},
      {name:'tickLower',type:'int24'},
      {name:'tickUpper',type:'int24'},
      {name:'liquidity',type:'uint128'},
      {name:'feeGrowthInside0LastX128',type:'uint256'},
      {name:'feeGrowthInside1LastX128',type:'uint256'},
      {name:'tokensOwed0',type:'uint128'},
      {name:'tokensOwed1',type:'uint128'}
    ]
  }
] as const;

// --- SwapRouter (exactInputSingle subset) ---
export const SwapRouterABI = [
  {
    name:'exactInputSingle', type:'function', stateMutability:'payable',
    inputs:[{name:'params',type:'tuple',components:[
      {name:'tokenIn',type:'address'},
      {name:'tokenOut',type:'address'},
      {name:'fee',type:'uint24'},
      {name:'recipient',type:'address'},
      {name:'deadline',type:'uint256'},
      {name:'amountIn',type:'uint256'},
      {name:'amountOutMinimum',type:'uint256'},
      {name:'sqrtPriceLimitX96',type:'uint160'}
    ]}],
    outputs:[{name:'amountOut',type:'uint256'}]
  }
] as const;

// --- Quoter V2 (MAKE SURE IT IS 'view') ---
export const QuoterV2ABI = [
  {
    name:'quoteExactInputSingle',
    type:'function',
    stateMutability:'view',
    inputs:[{name:'params',type:'tuple',components:[
      {name:'tokenIn',type:'address'},
      {name:'tokenOut',type:'address'},
      {name:'amountIn',type:'uint256'},
      {name:'fee',type:'uint24'},
      {name:'sqrtPriceLimitX96',type:'uint160'}
    ]}],
    outputs:[
      {name:'amountOut',type:'uint256'},
      {name:'sqrtPriceX96After',type:'uint160'},
      {name:'initializedTicksCrossed',type:'uint32'},
      {name:'gasEstimate',type:'uint256'}
    ]
  }
] as const;

// --- Minimal Uniswap V3 Pool ABI (to check liquidity) ---
export const V3_POOL_ABI = [
  { name:'liquidity', type:'function', stateMutability:'view', inputs:[], outputs:[{name:'',type:'uint128'}] },
  { name:'slot0',     type:'function', stateMutability:'view', inputs:[], outputs:[
    {name:'sqrtPriceX96',type:'uint160'},
    {name:'tick',type:'int24'},
    {name:'observationIndex',type:'uint16'},
    {name:'observationCardinality',type:'uint16'},
    {name:'observationCardinalityNext',type:'uint16'},
    {name:'feeProtocol',type:'uint8'},
    {name:'unlocked',type:'bool'}
  ] }
] as const;
