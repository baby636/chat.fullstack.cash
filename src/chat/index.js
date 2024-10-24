/*
  This is the top-level app that controls the Chat View on chat.fullstack.cash.
*/

import React from 'react'
import PropTypes from 'prop-types'

import { Row, Col } from 'adminlte-2-react'
import Handler from './handler'
import ChatTerminal from './terminals/chat-terminal'
import CommandTerminal from './terminals/command-terminal'
import StatusTerminal from './terminals/status-terminal'
import IpfsControl from './lib/ipfs-control'

import StatusBar from './status-bar'
import './chat.css'

// _this is the instance of this class. Used when 'this' loses
// that context.
let _this

class Chat extends React.Component {
  constructor (props) {
    super(props)
    _this = this

    this.state = {
      displayTerminal: 'Chat',
      statusOutput: '',
      commandOutput: "Enter 'help' to see available commands.",
      // This property contains an object that
      // will have the record of the different outputs
      // corresponding to each chat
      chatOutputs: {
        All: {
          output: '',
          nickname: ''
        }
      },
      nickname: 'Nicknames',
      peers: [],
      connectedPeer: 'All',
      focusedHandler: 'All' // This is to control the selected terminal css
    }

    const ipfsConfig = {
      statusLog: _this.onStatusLog,
      // handleChatLog: _this.onCommandLog
      handleChatLog: _this.incommingChat,
      bchWallet: props.bchWallet, // bch wallet instance
      privateLog: _this.privLogChat
    }
    // Retrieve last ipfs control
    const { data } = _this.props.menuNavigation
    if (data && data.chatInfo.ipfsControl) {
      this.ipfsControl = data.chatInfo.ipfsControl
    } else {
      // Instantiate a new ipfs control
      this.ipfsControl = new IpfsControl(ipfsConfig)
    }

    // CT: Should I instantiate the components here? I want to pass the log
    // handler to the IpfsControl library. Maybe we should make the statusLog()
    // function a static function for the component Class?
    // this.statusTerminal = new StatusTerminal()
    // this.commandTerminal = new CommandTerminal()
  }

  render () {
    const {
      displayTerminal,
      peers,
      connectedPeer,
      chatOutputs,
      focusedHandler
    } = _this.state

    // Obtains the registered chat of the selected peer
    const output = chatOutputs[connectedPeer]
      ? chatOutputs[connectedPeer].output
      : ''
    return (
      <Row className='chat-view'>
        <Col xs={12}>
          <StatusBar />
        </Col>
        <Col xs={12} lg={6} className='nodes-container'>
          <Handler
            handleTerminal={_this.onHandleTerminal}
            peers={peers}
            handlePeerName={_this.onHandlePeerName}
            currentTerminal={focusedHandler}
          />
        </Col>
        <Col xs={12} lg={6} className='terminals-container'>
          {displayTerminal === 'Chat' && (
            <ChatTerminal
              handleLog={_this.myChat}
              log={output}
              nickname={_this.state.nickname}
              ipfsControl={_this.ipfsControl}
              chatWith={connectedPeer}
              handlePeerName={_this.onHandlePeerName}
            />
          )}
          {displayTerminal === 'Command' && (
            <CommandTerminal
              handleLog={_this.onCommandLog}
              log={_this.state.commandOutput}
              ipfsControl={_this.ipfsControl}
            />
          )}
          {displayTerminal === 'Status' && (
            <StatusTerminal
              handleLog={_this.onStatusLog}
              log={_this.state.statusOutput}
            />
          )}
        </Col>
      </Row>
    )
  }

  async componentDidMount () {
    try {
      const { data } = _this.props.menuNavigation

      // Don't start ipfs if it has started already
      if (!data || !data.chatInfo.ipfsIsStarted) {
        await this.ipfsControl.startIpfs()
      }

      // Loads the previous information and states
      if (data && data.chatInfo) {
        const { savedState } = data.chatInfo
        _this.setState(savedState)
      }
      // _this.populatePeersWithMock()
    } catch (err) {
      console.error('Error in Chat componentDidMount(): ', err)
      // Do not throw an error. This is a top-level function.
    }
  }

  async componentWillUnmount () {
    const data = {
      chatInfo: {
        ipfsIsStarted: true,
        savedState: _this.state,
        ipfsControl: _this.ipfsControl
      }
    }
    // Save the current state
    _this.props.setMenuNavigation({ data })
  }

  // Switch between the different terminals.
  onHandleTerminal (object) {
    let { connectedPeer } = _this.state
    let focusedHandler = object.terminal
    // Verify if the selected terminal is a chat
    if (object.peer && object.peer !== connectedPeer) {
      connectedPeer = object.peer
      focusedHandler = object.peer
    }
    _this.setState({
      displayTerminal: object.terminal,
      connectedPeer,
      focusedHandler
    })
  }

  // Adds a line to the Status terminal
  onStatusLog (str) {
    try {
      // Update the Status terminal
      _this.setState({
        statusOutput: _this.state.statusOutput + '   ' + str + '\n'
      })

      // If a new peer is found, trigger handleNewPeer()
      if (str.includes('New peer found:')) {
        const ipfsId = str.substring(16)
        _this.handleNewPeer(ipfsId)
      }
    } catch (error) {
      console.warn(error)
    }
  }

  // This function is triggered when a new peer is detected.
  handleNewPeer (ipfsId) {
    try {
      console.log(`New IPFS peer discovered. ID: ${ipfsId}`)

      // Use the peer IPFS ID to identify the peers state.
      const { peers, chatOutputs } = _this.state

      // Add the new peer to the peers array.
      peers.push(ipfsId)

      // Add a chatOutput entry for the new peer.
      const obj = {
        output: '',
        nickname: ''
      }
      // chatOutputs[shortIpfsId] = obj
      chatOutputs[ipfsId] = obj

      _this.setState({
        peers,
        chatOutputs
      })
    } catch (err) {
      console.warn('Error in handleNewPeer(): ', err)
    }
  }

  // Handle decrypted, private messages and send them to the right terminal.
  privLogChat (str, from) {
    try {
      console.log(`privLogChat str: ${str}`)
      console.log(`privLogChat from: ${from}`)

      // Split the string into an ID and a message
      // const [id, msg] = str.split(': ')
      //
      // // console.log(`privLogChat2 ${id}: ${msg}`)

      const { chatOutputs } = _this.state

      const terminalOut = `peer: ${str}`

      // Asigns the output to the corresponding peer
      chatOutputs[from].output = chatOutputs[from].output + terminalOut + '\n'

      _this.setState({
        chatOutputs
      })
    } catch (err) {
      console.warn('Error in privLogChat():', err)
    }
  }

  // Handle chat messages coming in from the IPFS network.
  incommingChat (str) {
    try {
      const { chatOutputs, connectedPeer } = _this.state
      // console.log(`connectedPeer: ${JSON.stringify(connectedPeer, null, 2)}`)
      // console.log(`incommingChat str: ${JSON.stringify(str, null, 2)}`)

      const msg = str.data.data.message
      const handle = str.data.data.handle
      const terminalOut = `${handle}: ${msg}`

      if (str.data && str.data.apiName && str.data.apiName.includes('chat')) {
        // If the message is marked as 'chat' data, then post it to the public
        // chat terminal.
        chatOutputs.All.output = chatOutputs.All.output + terminalOut + '\n'
      } else {
        // Asigns the output to the corresponding peer
        chatOutputs[connectedPeer].output =
          chatOutputs[connectedPeer].output + terminalOut + '\n'
      }

      _this.setState({
        chatOutputs
      })
    } catch (err) {
      console.warn(err)
      // Don't throw an error as this is a top-level handler.
    }
  }

  // Updates the Chat terminal with chat input from the user.
  myChat (msg, nickname) {
    try {
      const { chatOutputs, connectedPeer } = _this.state
      const terminalOut = `me: ${msg}`

      if (connectedPeer === 'All') {
        chatOutputs.All.output = chatOutputs.All.output + terminalOut + '\n'
      } else {
        // Asigns the output to the corresponding peer
        chatOutputs[connectedPeer].output =
          chatOutputs[connectedPeer].output + terminalOut + '\n'
      }

      _this.setState({
        chatOutputs,
        nickname
      })
    } catch (err) {
      console.warn('Error in myChat(): ', err)
    }
  }

  // Adds a line to the Chat terminal
  onChatLog (str, nickname) {
    try {
      console.log(`onChatLog str: ${JSON.stringify(str, null, 2)}`)

      console.log(`typeof str: ${typeof str}`)

      let terminalOut = ''
      if (typeof str === 'string') {
        terminalOut = str
      } else {
        const msg = str.data.data.message
        const handle = str.data.data.handle
        terminalOut = `${handle}: ${msg}`
      }
      console.log(`terminalOut: ${terminalOut}`)

      _this.setState({
        chatOutput: _this.state.chatOutput + '   ' + terminalOut + '\n',
        nickname
      })
    } catch (error) {
      console.warn(error)
    }
  }

  // Adds a line to the Command terminal
  onCommandLog (msg) {
    try {
      let commandOutput
      if (!msg) {
        commandOutput = ''
      } else {
        commandOutput = _this.state.commandOutput + '   ' + msg + '\n'
      }
      _this.setState({
        commandOutput
      })
    } catch (error) {
      console.warn(error)
    }
  }

  // Searchs for the name associated to the peerId
  onHandlePeerName (peerId) {
    try {
      if (!peerId) return null

      const peersInfo = _this.ipfsControl.ipfsCoord.ipfs.peers.state.peers
      const peerInfo = peersInfo[peerId]
      const name = peerInfo.jsonLd.name
      if (!name) return peerId
      return name
    } catch (error) {
      return peerId
    }
  }

  // Adds several test perrs
  // Function with testing purposes
  // to evaluate the UI behavior
  // with a considerable amount of peers
  populatePeersWithMock () {
    try {
      for (let i = 0; i < 10; i++) {
        _this.handleNewPeer(`peer ${i}`)
      }
    } catch (error) {
      console.warn('Error in populatePeersWithMock(): ', error)
    }
  }
}

// Props prvided by redux
Chat.propTypes = {
  bchWallet: PropTypes.object, // get minimal-slp-wallet instance
  menuNavigation: PropTypes.object,
  setMenuNavigation: PropTypes.func
}

export default Chat
