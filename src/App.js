import React, { useEffect, useState } from 'react';
import './App.css';
import { initMap } from '@dstanesc/shared-property-map';
import { partReport } from '@dstanesc/fake-metrology-data'

import { pack } from 'msgpackr';
import * as lz4 from 'lz4js'
import * as pako from 'pako'

import { bufferToString, stringToBuffer } from "@fluidframework/common-utils";
import { layout, trace } from './plot';

function App() {

  const [button, setButton] = useState("Start e2e");
  const [message, setMessage] = useState("Not Started");

  // local view

  const [localValue, setLocalValue] = useState();

  const [sharedPropertyMap, setSharedPropertyMap] = useState();

  // remote view

  const [remoteValue, setRemoteValue] = useState();

  const [remotePropertyMap, setRemotePropertyMap] = useState();

  // timing

  const [startTimes, setStartTimes] = useState(new Map());

  const [endTimes, setEndTimes] = useState(new Map());

  const [sizes, setSizes] = useState(new Map());

  const [origSizes, setOrigSizes] = useState(new Map());

  const [durations, setDurations] = useState(new Map());

  const mapId = window.location.hash.substring(1) || undefined;


  async function init() {
    const sharedMap = await initMap(
      mapId,
      updateLocalModel,
      updateLocalModel,
      deleteLocalModel
    );
    if (mapId === undefined) {
      window.location.hash = sharedMap.mapId();
    }
    setSharedPropertyMap(sharedMap);
    return sharedMap.mapId();
  }

  useEffect(() => {
    init().then(localId => {
      const remoteView = initMap(
        localId,
        updateRemoteModel,
        updateRemoteModel,
        deleteRemoteModel
      );
      setRemotePropertyMap(remoteView);
    });

  }, []);

  useEffect(() => {
    const traces = []
    durations.forEach((value, key) => {
      const what = key.split("-");
      const lib = what[1];
      const count = what[0];
      const bytes = sizes.get(key);
      const origBytes = origSizes.get(key);
      const duration = value;
      const t = trace({ lib, count, bytes, origBytes, values: [bytes, duration], text: [`Compressed ${bytes} MiB, Original ${origBytes} MiB`, `Compressed ${bytes} MiB, Original ${origBytes} MiB, Speed ${duration} ms`] });
      traces.push(t);
    });
    Plotly.newPlot('plotDiv', traces, layout());
  }, [durations]);

  useEffect(() => {
    const times = new Map();
    endTimes.forEach((endTime, key) => {
      const startTime = startTimes.get(key);
      const duration = endTime - startTime;
      console.log(`Setting latency for key ${key}, value=${duration}`);
      times.set(key, duration)
    });
    setDurations(times);
  }, [endTimes]);


  const updateLocalModel = (key, value) => {
    console.log(`Updating local model ${key} -> big value`);
    //setLocalValue(key);
  };

  const deleteLocalModel = (key) => {
    console.log(`Deleting local model ${key}`);
  };

  const updateRemoteModel = (key, value) => {
    const d = new Date();
    const localTime = d.getTime();
    console.log(`Updating remote endTime=${localTime} remote model ${key} -> big value`);
    setEndTimes(new Map(endTimes.set(key, localTime)));
    //setRemoteValue(key);
    const len = miB((new TextEncoder().encode(value)).length);
    setSizes(new Map(sizes.set(key, len)));
    setMessage(`Received ${key}, total size ${len} MiB`);
    if (key.startsWith(`800`))
      setButton(`Start e2e`);
    else
      setButton(`Running`);
  };

  const deleteRemoteModel = (key) => {
    console.log(`Deleting remote model ${key}`);
    setMessage(`Deleting ${key}`)
    setButton(`Running`)
  };

  const roll = async () => {
    if (sharedPropertyMap) {
      await cleanUp();
      const json50 = partReport({ reportSize: 50 });
      const json100 = partReport({ reportSize: 100 });
      const json300 = partReport({ reportSize: 300 });
      const json600 = partReport({ reportSize: 600 });
      const json800 = partReport({ reportSize: 800 });

      await execFn(rollJson, 50, json50);
      await execFn(rollPako, 50, json50);
      await execFn(rollLz4, 50, json50);
      await execFn(rollJson, 100, json100);
      await execFn(rollPako, 100, json100);
      await execFn(rollLz4, 100, json100);
      await execFn(rollPako, 300, json300);
      await execFn(rollLz4, 300, json300);
      await execFn(rollPako, 600, json600);
      await execFn(rollLz4, 600, json600);
      await execFn(rollPako, 800, json800);

    } else {
      alert("Please wait to initialize")
    }
  }

  const cleanUp = async () => {

    for (const key of startTimes.keys()) {
      await execFn(() => {
        if (sharedPropertyMap.has(key)) {
          sharedPropertyMap.delete(key);
          sharedPropertyMap.commit();
        }
      });
    }
  }

  // Fluid fails if adding data too fast
  const execFn = (fn, arg1, arg2) => {
    fn(arg1, arg2);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, 3 * 1000); 
    });
  }

  const rollJson = (size, json) => {
    const jsonText = JSON.stringify(json);
    const d = new Date();
    const localTime = d.getTime();
    const key = size + "-json";
    const newStartTimes = startTimes.set(key, localTime);
    setStartTimes(new Map(newStartTimes));
    const origSize = miB(new TextEncoder().encode(jsonText).length);
    const newOrigSizes = origSizes.set(key, origSize);
    setOrigSizes(new Map(newOrigSizes));
    sharedPropertyMap.set(key, jsonText);
    sharedPropertyMap.commit();
    console.log(`rollJson startTime=${localTime}`);
  };

  const rollPako = (size, json) => {
    const d = new Date();
    const localTime = d.getTime();
    const key = size + "-pako";
    const newStartTimes = startTimes.set(key, localTime);
    setStartTimes(new Map(newStartTimes));
    const buf = pack(json);
    const origSize = miB(buf.length);
    const newOrigSizes = origSizes.set(key, origSize);
    setOrigSizes(new Map(newOrigSizes));
    const ser = pako.deflate(buf);
    const b64 = bufferToString(ser, "base64");
    sharedPropertyMap.set(key, b64);
    sharedPropertyMap.commit();
    console.log(`rollPako startTime=${localTime} `);
  };

  const rollLz4 = (size, json) => {
    const d = new Date();
    const localTime = d.getTime();
    const key = size + "-lz4";
    const newStartTimes = startTimes.set(key, localTime);
    setStartTimes(new Map(newStartTimes));
    const buf = pack(json);
    const origSize = miB(buf.length);
    const newOrigSizes = origSizes.set(key, origSize);
    setOrigSizes(new Map(newOrigSizes));
    const ser = lz4.compress(buf);
    const b64 = bufferToString(ser, "base64");
    sharedPropertyMap.set(key, b64);
    sharedPropertyMap.commit();
    console.log(`rollLz4 startTime=${localTime}`);
  };

  const encoder = new TextEncoder()

  const rate = (origSize, deflatedSize) => {
    return (((origSize - deflatedSize) / origSize) * 100).toFixed(2);
  }

  const miB = (size) => {
    return (size / (1024 * 1024)).toFixed(2);
  }

  return (
    <div className="App">
      <div className="remote" onClick={() => roll()}>
        [{button}]
      </div>
      <div className="message">
        {message}
      </div>
      <div id='plotDiv'></div>
    </div>
  );
}

export default App;
