package automationcontract

import (
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"os"
	"strconv"
	"testing"

	"github.com/hashimthearab/rust-mcbe/core/internal/bridgecontract"
)

func TestWireVectors(t *testing.T) {
	data, err := os.ReadFile("../../../Bedform/Contract/vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var vectors struct {
		Session struct {
			Generation uint64
			Player     struct{ EntityID, RuntimeID string }
		}
		Input []struct {
			Valid   bool
			Command struct{ Input struct{ Action string } }
		}
		Packet  struct{ FramedBatchHex string }
		Request struct {
			V  uint32
			Op string
		}
	}
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatal(err)
	}
	if vectors.Request.V != Version || vectors.Request.Op != OperationCapabilities || vectors.Session.Generation != 1 {
		t.Fatal("version, operation or generation drift")
	}
	entity, err := strconv.ParseInt(vectors.Session.Player.EntityID, 10, 64)
	if err != nil || entity != -1<<63 {
		t.Fatalf("native entity ID drift: %d, %v", entity, err)
	}
	runtime, err := strconv.ParseUint(vectors.Session.Player.RuntimeID, 10, 64)
	if err != nil || runtime != 1<<64-1 {
		t.Fatalf("native runtime ID drift: %d, %v", runtime, err)
	}
	for _, vector := range vectors.Input {
		if action := vector.Command.Input.Action; IsAction(action) != vector.Valid {
			t.Errorf("action registry disagreement for %q", action)
		}
	}
	frame, err := hex.DecodeString(vectors.Packet.FramedBatchHex)
	if err != nil || len(frame) < 5 || binary.BigEndian.Uint32(frame) != uint32(len(frame)-4) ||
		frame[4] != bridgecontract.SessionKindBatch {
		t.Fatalf("Cinnabar packet frame drift: %x, %v", frame, err)
	}
}
